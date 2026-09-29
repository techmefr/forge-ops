<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Tag } from '@contract/EpicContract'
import EffectBadge from './EffectBadge.vue'
import { usedBy } from './TeamRule'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useRefusalFocus } from '@/technical/Ui/FieldState'

const { t } = useI18n()
const say = usePhrase()

const tags = useResource<readonly Tag[]>(() => board.read('/api/tags'))
const refusal = ref<Phrase | null>(null)
const addRefusal = ref<Phrase | null>(null)
const addForm = ref<HTMLElement | null>(null)
useRefusalFocus(addRefusal, addForm)
const label = ref('')
const colour = ref('#e08a00')

async function guard(action: () => Promise<void>): Promise<void> {
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  }
  await tags.reload()
}

function usage(tag: Tag): string {
  const reason = usedBy(tag.usage)
  return reason === null ? t('team.unused') : say(reason)
}

function recolour(tag: Tag, event: Event): Promise<void> {
  return guard(async () => {
    await board.send(`/api/tags/${tag.id}`, 'PUT', {
      label: tag.label,
      colour: (event.target as HTMLInputElement).value,
    })
  })
}

function remove(tag: Tag): Promise<void> {
  return guard(async () => {
    await board.send(`/api/tags/${tag.id}`, 'DELETE', undefined)
  })
}

async function add(): Promise<void> {
  await guard(async () => {
    await board.send('/api/tags', 'POST', { label: label.value.trim(), colour: colour.value })
    label.value = ''
  })
  addRefusal.value = refusal.value
  refusal.value = null
}

void tags.reload()
</script>

<template>
  <section class="flex flex-col gap-4 border-t border-line pt-6" data-tour="setting-tags">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('team.tags') }}</h2>
      <EffectBadge section="tags" />
    </div>
    <p class="m-0 text-[13px] text-txt-mid">{{ t('team.tagsSub') }}</p>

    <p v-if="refusal !== null" class="m-0 text-[13px] text-red" role="alert">{{ say(refusal) }}</p>
    <p v-if="tags.failure.value !== null" class="m-0 text-[13px] text-red" role="alert">
      {{ say(tags.failure.value) }}
    </p>

    <p v-if="(tags.data.value ?? []).length === 0" class="m-0 text-[13px] text-txt-low">
      {{ t('team.noTags') }}
    </p>
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="tag in tags.data.value ?? []"
        :key="tag.id"
        class="flex flex-wrap items-center gap-3 rounded-md bg-panel px-3 py-2"
      >
        <label class="flex items-center">
          <span class="sr-only">{{ t('team.colourOf', { name: tag.label }) }}</span>
          <input
            type="color"
            :value="tag.colour"
            class="h-8 w-9 rounded-md border border-line bg-transparent p-0.5"
            @change="recolour(tag, $event)"
          />
        </label>
        <div class="min-w-[9rem] flex-1">
          <span
            class="inline-block rounded-md border px-2 py-0.5 text-[13px] text-txt-hi"
            :style="{ borderColor: tag.colour }"
            >#{{ tag.label }}</span
          >
          <p
            :id="`tag-use-${tag.id}`"
            class="m-0 text-[11px]"
            :class="tag.usage === 0 ? 'text-txt-low' : 'text-orange'"
          >
            {{ usage(tag) }}
          </p>
        </div>
        <RouterLink
          :to="{ path: '/projects/subjects', query: { tag: String(tag.id) } }"
          class="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-txt-mid uppercase hover:border-acc"
          >{{ t('team.seeSubjects') }}<span class="sr-only"> #{{ tag.label }}</span></RouterLink
        >
        <button
          type="button"
          :disabled="tag.usage > 0"
          :aria-describedby="`tag-use-${tag.id}`"
          class="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-txt-mid uppercase hover:border-red disabled:opacity-40"
          @click="remove(tag)"
        >
          {{ t('team.delete') }}<span class="sr-only"> #{{ tag.label }}</span>
        </button>
      </li>
    </ul>

    <form ref="addForm" class="flex flex-wrap items-center gap-2" @submit.prevent="add">
      <label class="flex items-center">
        <span class="sr-only">{{ t('team.newTagColour') }}</span>
        <input
          v-model="colour"
          type="color"
          class="h-8 w-9 rounded-md border border-line bg-transparent p-0.5"
        />
      </label>
      <label class="sr-only" for="new-tag-label">{{ t('team.newTag') }}</label>
      <input
        id="new-tag-label"
        v-model="label"
        v-bind="requiredField(addRefusal, 'tags-add-refusal')"
        type="text"
        maxlength="40"
        :placeholder="`${t('team.newTag')} *`"
        class="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
      />
      <button
        type="submit"
        :disabled="label.trim() === ''"
        class="rounded-md border border-acc bg-acc px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
      >
        {{ t('team.add') }}
      </button>
      <RequiredNote class="basis-full" />
      <p v-if="addRefusal !== null" id="tags-add-refusal" class="m-0 basis-full text-[13px] text-red" role="alert">
        {{ say(addRefusal) }}
      </p>
    </form>

    <p class="m-0 text-[11px] text-txt-low">{{ t('team.tagsFoot') }}</p>
  </section>
</template>
