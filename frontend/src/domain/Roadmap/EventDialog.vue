<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import ProjectPicker from '@/domain/Project/ProjectPicker.vue'
import { board } from '@/technical/Api/Board'
import { keepDialogWhileListboxOpen } from '@/technical/Ui/ListboxEscape'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import {
  EVENT_MINUTES_LIMIT,
  EVENT_NOTE_LIMIT,
  EVENT_TITLE_LIMIT,
  EVENT_TYPES,
  type EventType,
  type ProjectEvent,
} from '@contract/EventContract'
import type { RoadmapProject } from './UseRoadmap'

const props = defineProps<{
  projects: readonly RoadmapProject[]
  event: ProjectEvent | null
  projectId: number | null
  epicId: number | null
  today: string
}>()
const emit = defineEmits<{ close: []; saved: []; changed: [] }>()

const { t } = useI18n()
const say = usePhrase()

const type = ref<EventType>('demo')
const date = ref('')
const title = ref('')
const chosenProject = ref(0)
const chosenEpic = ref<number | null>(null)
const note = ref('')
const minutes = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const confirmingRemoval = ref(false)

const editing = computed(() => props.event !== null)
const pickable = computed(() => props.projects.map((entry) => entry.project))

const subjects = computed(
  () => props.projects.find((entry) => entry.project.id === chosenProject.value)?.subjects ?? [],
)

watch(
  () => [props.event, props.projectId, props.epicId] as const,
  () => {
    const event = props.event
    type.value = event?.type ?? 'demo'
    date.value = event?.date ?? props.today
    title.value = event?.title ?? ''
    chosenProject.value = event?.projectId ?? props.projectId ?? props.projects[0]?.project.id ?? 0
    chosenEpic.value = event?.epicId ?? props.epicId
    note.value = event?.note ?? ''
    minutes.value = event?.minutes ?? ''
    refusal.value = null
    confirmingRemoval.value = false
  },
  { immediate: true },
)

watch(chosenProject, () => {
  if (!subjects.value.some((subject) => subject.id === chosenEpic.value)) {
    chosenEpic.value = null
  }
})

function changes(): Record<string, unknown> {
  return {
    type: type.value,
    date: date.value,
    title: title.value,
    epicId: chosenEpic.value,
    note: note.value.trim() === '' ? null : note.value,
    minutes: minutes.value,
  }
}

async function guard(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
    emit('saved')
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function save(): Promise<void> {
  const event = props.event
  if (event !== null) {
    return guard(() => board.send(`/api/events/${event.id}`, 'PATCH', changes()))
  }
  return guard(() =>
    board.send('/api/events', 'POST', { ...changes(), projectId: chosenProject.value }),
  )
}

function remove(): Promise<void> {
  const event = props.event
  if (event === null) {
    return Promise.resolve()
  }
  if (!confirmingRemoval.value) {
    confirmingRemoval.value = true
    return Promise.resolve()
  }
  return guard(() => board.send(`/api/events/${event.id}`, 'DELETE'))
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    emit('close')
  }
}
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-panel p-6"
        @escape-key-down="keepDialogWhileListboxOpen"
      >
        <DialogTitle class="display-italic text-lg text-txt-hi uppercase">
          {{ t(editing ? 'roadmap.form.editTitle' : 'roadmap.form.newTitle') }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-[13px] text-txt-mid">
          {{ t('roadmap.form.description') }}
        </DialogDescription>

        <form class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" @submit.prevent="save">
          <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
            {{ t('roadmap.form.type') }}
            <select
              v-model="type"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            >
              <option v-for="kind in EVENT_TYPES" :key="kind" :value="kind">
                {{ t(`milestone.${kind}`) }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
            {{ t('roadmap.form.date') }}
            <input
              v-model="date"
              type="date"
              required
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
          </label>

          <label class="flex flex-col gap-1 text-[13px] text-txt-mid sm:col-span-2">
            {{ t('roadmap.form.title') }}
            <input
              v-model="title"
              type="text"
              :maxlength="EVENT_TITLE_LIMIT"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
          </label>

          <div class="flex flex-col gap-1 text-[13px] text-txt-mid">
            <label for="event-form-project">{{ t('roadmap.form.project') }}</label>
            <ProjectPicker
              id="event-form-project"
              :model-value="chosenProject"
              :projects="pickable"
              :disabled="editing"
              test-id="event-form-project"
              @update:model-value="chosenProject = $event ?? 0"
              @created="emit('changed')"
            />
          </div>

          <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
            {{ t('roadmap.form.subject') }}
            <select
              v-model="chosenEpic"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            >
              <option :value="null">{{ t('roadmap.form.noSubject') }}</option>
              <option v-for="subject in subjects" :key="subject.id" :value="subject.id">
                {{ subject.title }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-[13px] text-txt-mid sm:col-span-2">
            {{ t('roadmap.form.note') }}
            <textarea
              v-model="note"
              rows="2"
              :maxlength="EVENT_NOTE_LIMIT"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
          </label>

          <label class="flex flex-col gap-1 text-[13px] text-txt-mid sm:col-span-2">
            {{ t('roadmap.form.minutes') }}
            <textarea
              v-model="minutes"
              rows="5"
              :maxlength="EVENT_MINUTES_LIMIT"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
            <span class="text-[11px] text-txt-low">{{ t('roadmap.form.minutesHint') }}</span>
          </label>

          <p
            v-if="refusal !== null"
            class="rounded-lg border border-red bg-red-soft/10 p-3 text-sm text-txt-hi sm:col-span-2"
            role="alert"
          >
            {{ say(refusal) }}
          </p>

          <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button
              v-if="editing"
              type="button"
              :disabled="busy"
              class="rounded-lg border border-red px-4 py-2 text-xs font-bold text-red uppercase disabled:opacity-40"
              @click="remove"
            >
              {{ t(confirmingRemoval ? 'roadmap.form.confirmDelete' : 'roadmap.form.delete') }}
            </button>
            <button
              type="button"
              class="ml-auto rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase hover:border-acc"
              @click="emit('close')"
            >
              {{ t('roadmap.form.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="busy || date === ''"
              class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
            >
              {{ t(editing ? 'roadmap.form.save' : 'roadmap.form.add') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
