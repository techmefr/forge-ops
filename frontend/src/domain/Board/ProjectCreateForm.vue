<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import RequiredStar from '@/technical/Ui/RequiredStar.vue'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useRefusalFocus } from '@/technical/Ui/FieldState'

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

const formEl = ref<HTMLElement | null>(null)
useRefusalFocus(refusal, formEl)
</script>

<template>
  <form ref="formEl" class="flex flex-col gap-3" @submit.prevent="create">
    <label class="flex flex-col gap-1 text-sm text-txt-mid">
      <span>{{ t('projectCreate.name') }} <RequiredStar /></span>
      <input
        v-model="name"
        v-bind="requiredField(refusal, 'project-create-refusal')"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
      />
    </label>

    <label class="flex flex-col gap-1 text-sm text-txt-mid">
      <span>{{ t('projectCreate.slug') }} <RequiredStar /></span>
      <input
        v-model="slug"
        v-bind="requiredField(refusal, 'project-create-refusal')"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-sm text-txt-hi"
      />
      <span class="text-xs text-txt-low">{{ t('projectCreate.slugHint') }}</span>
    </label>

    <label class="flex flex-col gap-1 text-sm text-txt-mid">
      <span>{{ t('projectCreate.repositoryUrl') }} <RequiredStar /></span>
      <input
        v-model="repositoryUrl"
        v-bind="requiredField(refusal, 'project-create-refusal')"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
      />
    </label>

    <label class="flex flex-col gap-1 text-sm text-txt-mid">
      <span>{{ t('projectCreate.integrationBranch') }} <RequiredStar /></span>
      <input
        v-model="integrationBranch"
        v-bind="requiredField(refusal, 'project-create-refusal')"
        type="text"
        class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-sm text-txt-hi"
      />
    </label>

    <label class="flex flex-col gap-1 text-sm text-txt-mid">
      {{ t('projectCreate.colour') }}
      <input v-model="colour" type="color" class="h-9 w-16 rounded-md border border-line bg-elev" />
    </label>

    <div class="flex items-center gap-3">
      <button
        type="submit"
        :disabled="busy || slug === '' || name === '' || repositoryUrl === '' || integrationBranch === ''"
        class="rounded-lg border border-acc bg-acc px-4 py-2 text-sm font-bold text-ink disabled:opacity-40"
      >
        {{ t('projectCreate.create') }}
      </button>
      <button
        type="button"
        class="text-sm text-txt-low underline"
        @click="emit('cancel')"
      >
        {{ t('projectCreate.cancel') }}
      </button>
    </div>

    <RequiredNote />
    <p id="project-create-refusal" v-if="refusal !== null" class="text-sm text-red" role="alert">{{ say(refusal) }}</p>
  </form>
</template>
