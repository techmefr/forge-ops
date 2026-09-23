<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'

const emit = defineEmits<{ created: []; cancel: [] }>()

const { t } = useI18n()
const say = usePhrase()

const slug = ref('')
const name = ref('')
const repositoryUrl = ref('')
const integrationBranch = ref('main')
const colour = ref('#5b8def')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

async function create(): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await board.send('/api/projects', 'POST', {
      slug: slug.value,
      name: name.value,
      repositoryUrl: repositoryUrl.value,
      integrationBranch: integrationBranch.value,
      colour: colour.value,
    })
    emit('created')
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="create">
    <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
      {{ t('projectCreate.name') }}
      <input
        v-model="name"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
      />
    </label>

    <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
      {{ t('projectCreate.slug') }}
      <input
        v-model="slug"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-[13px] text-txt-hi"
      />
      <span class="text-[11px] text-txt-low">{{ t('projectCreate.slugHint') }}</span>
    </label>

    <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
      {{ t('projectCreate.repositoryUrl') }}
      <input
        v-model="repositoryUrl"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
      />
    </label>

    <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
      {{ t('projectCreate.integrationBranch') }}
      <input
        v-model="integrationBranch"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-[13px] text-txt-hi"
      />
    </label>

    <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
      {{ t('projectCreate.colour') }}
      <input v-model="colour" type="color" class="h-9 w-16 rounded-md border border-line bg-elev" />
    </label>

    <div class="flex items-center gap-3">
      <button
        type="submit"
        :disabled="busy || slug === '' || name === '' || repositoryUrl === '' || integrationBranch === ''"
        class="rounded-lg border border-acc bg-acc px-4 py-2 text-[13px] font-bold text-ink uppercase disabled:opacity-40"
      >
        {{ t('projectCreate.create') }}
      </button>
      <button
        type="button"
        class="text-[13px] text-txt-low underline"
        @click="emit('cancel')"
      >
        {{ t('projectCreate.cancel') }}
      </button>
    </div>

    <p v-if="refusal !== null" class="text-[13px] text-red" role="alert">{{ say(refusal) }}</p>
  </form>
</template>
