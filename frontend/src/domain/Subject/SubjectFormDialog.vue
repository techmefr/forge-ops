<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { EPIC_PRIORITIES, type Tag } from '@contract/EpicContract'
import { DEADLINE_KINDS } from '@contract/StoryContract'
import type { ProjectEvent } from '@contract/EventContract'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import ProjectPicker from '@/domain/Project/ProjectPicker.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { keepDialogWhileListboxOpen } from '@/technical/Ui/ListboxEscape'
import SubjectFormDepends from './SubjectFormDepends.vue'
import SubjectFormLinks from './SubjectFormLinks.vue'
import SubjectFormTags from './SubjectFormTags.vue'
import {
  NOTE_LIMIT,
  REQUESTED_BY_LIMIT,
  TITLE_LIMIT,
  changesOf,
  creationOf,
  emptyForm,
  firstIssueField,
  formOf,
  issuesOf,
  milestoneStep,
  stateAfterOwnerChange,
  type FieldName,
  type FormIssue,
  type SubjectForm,
} from './SubjectFormRule'
import type { Person } from './UseSubjects'

const MILESTONE_KIND = 'production'
const EVENT_TITLE_LIMIT = 120

const props = defineProps<{
  subject: EpicOverview | null
  projects: readonly Project[]
  projectId: number | null
  people: readonly Person[]
  tags: readonly Tag[]
  subjects: readonly EpicOverview[]
}>()

const emit = defineEmits<{ close: []; saved: [id: number]; changed: [] }>()

const { t } = useI18n()
const say = usePhrase()

const editing = props.subject !== null
const form = ref<SubjectForm>(
  props.subject === null ? emptyForm(props.projectId ?? props.projects[0]?.id ?? null) : formOf(props.subject, null),
)
const issues = ref<readonly FormIssue[]>([])
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const formElement = ref<HTMLFormElement | null>(null)
const madeTags = ref<readonly Tag[]>([])
const milestoneEvent = ref<{ id: number; date: string } | null>(null)
const savedId = ref<number | null>(null)
const coreDone = ref(false)

const knownTags = computed(() => [
  ...props.tags,
  ...madeTags.value.filter((made) => !props.tags.some((tag) => tag.id === made.id)),
])
const ownerOptions = computed(() => {
  const listed = [...props.people]
  const owner = props.subject?.assignee ?? null
  if (owner !== null && !listed.some((person) => person.login === owner)) {
    listed.push({ login: owner, displayName: owner, capacity: null, active: true })
  }
  return listed
})
const hasIssues = computed(() => issues.value.length > 0)

function messageOf(field: FieldName): string | null {
  return issues.value.find((issue) => issue.field === field)?.message ?? null
}

function invalid(field: FieldName): boolean {
  return messageOf(field) !== null
}

function describedBy(field: FieldName): string | undefined {
  return invalid(field) ? `subject-form-${field}-error` : undefined
}

function borderOf(field: FieldName): string {
  return invalid(field) ? 'border-red' : 'border-line'
}

async function loadMilestone(): Promise<void> {
  const subject = props.subject
  if (subject === null) {
    return
  }
  const events = await board
    .read<readonly ProjectEvent[]>(`/api/projects/${subject.projectId}/events`)
    .catch(() => [] as readonly ProjectEvent[])
  const own = events
    .filter((event) => event.epicId === subject.id && (DEADLINE_KINDS as readonly string[]).includes(event.type))
    .sort((one, other) => one.date.localeCompare(other.date))
  const match = own.find((event) => event.date === subject.dueOn) ?? own[0]
  if (match !== undefined) {
    milestoneEvent.value = { id: match.id, date: match.date }
    if (form.value.milestone === '') {
      form.value = { ...form.value, milestone: match.date }
    }
  }
}

async function writeMilestone(subjectId: number): Promise<void> {
  const existing = milestoneEvent.value
  const step = milestoneStep(existing?.date ?? null, form.value.milestone)
  let createdId: number | null = null
  if (step === 'create') {
    const created = await board.send<ProjectEvent>('/api/events', 'POST', {
      type: MILESTONE_KIND,
      date: form.value.milestone,
      title: form.value.title.trim().slice(0, EVENT_TITLE_LIMIT),
      projectId: form.value.projectId,
      epicId: subjectId,
    })
    createdId = created.id
  } else if (step === 'change' && existing !== null) {
    await board.send(`/api/events/${existing.id}`, 'PATCH', { date: form.value.milestone })
  } else if (step === 'remove' && existing !== null) {
    await board.send(`/api/events/${existing.id}`, 'DELETE')
  }
  milestoneEvent.value =
    form.value.milestone === '' ? null : { id: createdId ?? existing?.id ?? 0, date: form.value.milestone }
}

async function writeCore(): Promise<number> {
  const subject = props.subject
  if (subject === null) {
    const created = await board.send<{ id: number }>('/api/epics', 'POST', creationOf(form.value))
    return created.id
  }
  const owner = form.value.owner
  const state = stateAfterOwnerChange(subject, owner)
  if ((subject.assignee ?? '') !== owner) {
    await board.send(`/api/epics/${subject.id}/assignee`, 'PUT', { login: owner === '' ? null : owner })
  }
  await board.send(`/api/epics/${subject.id}`, 'PATCH', {
    ...changesOf(form.value),
    ...(state === null ? {} : { state }),
  })
  return subject.id
}

async function focusFirstProblem(): Promise<void> {
  await nextTick()
  const field = firstIssueField(issues.value)
  const scope = field === null ? '' : `[data-field="${field}"] `
  const target = formElement.value?.querySelector<HTMLElement>(`${scope}[aria-invalid="true"]`)
  target?.focus()
}

async function submit(): Promise<void> {
  refusal.value = null
  issues.value = issuesOf(form.value)
  if (hasIssues.value) {
    await focusFirstProblem()
    return
  }
  busy.value = true
  try {
    if (!coreDone.value) {
      savedId.value = await writeCore()
      coreDone.value = true
      emit('changed')
    }
    const id = savedId.value
    if (id !== null) {
      await writeMilestone(id)
      emit('saved', id)
    }
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function tagMade(tag: Tag): void {
  madeTags.value = [...madeTags.value, tag]
  emit('changed')
}

async function leave(): Promise<void> {
  if (!coreDone.value && madeTags.value.length > 0) {
    await Promise.allSettled(madeTags.value.map((tag) => board.send(`/api/tags/${tag.id}`, 'DELETE')))
    emit('changed')
  }
  emit('close')
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    void leave()
  }
}

onMounted(loadMilestone)
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-panel p-5 sm:p-6"
        data-test-id="subject-form-dialog"
        @escape-key-down="keepDialogWhileListboxOpen"
      >
        <DialogTitle class="title-face text-sm text-txt-hi">
          {{ t(editing ? 'subjects.form.editTitle' : 'subjects.form.newTitle') }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-sm text-txt-mid">
          {{ t(editing ? 'subjects.form.editDescription' : 'subjects.form.description') }}
        </DialogDescription>

        <form
          ref="formElement"
          class="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 min-[760px]:grid-cols-2"
          novalidate
          @submit.prevent="submit"
        >
          <div class="flex flex-col gap-1 text-sm text-txt-mid min-[760px]:col-span-2" data-field="title">
            <label for="subject-form-title">{{ t('subjects.form.title') }} *</label>
            <input
              id="subject-form-title"
              v-model="form.title"
              type="text"
              :maxlength="TITLE_LIMIT"
              autocomplete="off"
              :placeholder="t('subjects.form.titlePlaceholder')"
              class="rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              :class="borderOf('title')"
              :aria-invalid="invalid('title')"
              :aria-describedby="describedBy('title')"
              data-test-id="subject-form-title"
            />
            <p v-if="messageOf('title') !== null" id="subject-form-title-error" class="text-xs text-red">
              {{ t(messageOf('title') ?? '') }}
            </p>
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid" data-field="project">
            <label for="subject-form-project">{{ t('subjects.form.project') }} *</label>
            <ProjectPicker
              id="subject-form-project"
              v-model="form.projectId"
              :projects="projects"
              :disabled="editing"
              :invalid="invalid('project')"
              :describedby="describedBy('project')"
              test-id="subject-form-project"
              @created="emit('changed')"
            />
            <p v-if="messageOf('project') !== null" id="subject-form-project-error" class="text-xs text-red">
              {{ t(messageOf('project') ?? '') }}
            </p>
            <p v-else class="text-xs text-txt-low">
              {{ t(editing ? 'subjects.form.projectLocked' : 'subjects.form.projectHint') }}
            </p>
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid">
            <label for="subject-form-owner">{{ t('subjects.form.owner') }}</label>
            <select
              id="subject-form-owner"
              v-model="form.owner"
              class="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              data-test-id="subject-form-owner"
            >
              <option value="">{{ t('subjects.form.nobody') }}</option>
              <option v-for="person in ownerOptions" :key="person.login" :value="person.login">
                {{ person.displayName }}
              </option>
            </select>
            <p class="text-xs text-txt-low">{{ t('subjects.form.ownerHint') }}</p>
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid">
            <label for="subject-form-priority">{{ t('subjects.form.priority') }}</label>
            <select
              id="subject-form-priority"
              v-model="form.priority"
              class="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              data-test-id="subject-form-priority"
            >
              <option v-for="priority in EPIC_PRIORITIES" :key="priority" :value="priority">
                {{ t(`epicPriority.${priority}`) }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid" data-field="requestedBy">
            <label for="subject-form-requested-by">{{ t('subjects.form.requestedBy') }}</label>
            <input
              id="subject-form-requested-by"
              v-model="form.requestedBy"
              type="text"
              :maxlength="REQUESTED_BY_LIMIT"
              autocomplete="off"
              :placeholder="t('subjects.form.requestedByPlaceholder')"
              class="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              data-test-id="subject-form-requested-by"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid">
            <label for="subject-form-start">{{ t('subjects.form.start') }}</label>
            <input
              id="subject-form-start"
              v-model="form.startedOn"
              type="date"
              class="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              data-test-id="subject-form-start"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid" data-field="milestone">
            <label for="subject-form-milestone">{{ t('subjects.form.milestone') }}</label>
            <input
              id="subject-form-milestone"
              v-model="form.milestone"
              type="date"
              class="rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              :class="borderOf('milestone')"
              :aria-invalid="invalid('milestone')"
              :aria-describedby="describedBy('milestone')"
              data-test-id="subject-form-milestone"
            />
            <p v-if="messageOf('milestone') !== null" id="subject-form-milestone-error" class="text-xs text-red">
              {{ t(messageOf('milestone') ?? '') }}
            </p>
            <p v-else class="text-xs text-txt-low">{{ t('subjects.form.milestoneHint') }}</p>
          </div>

          <div class="min-[760px]:col-span-2">
            <SubjectFormTags v-model="form.tagIds" :tags="knownTags" @created="tagMade" />
          </div>

          <div class="min-[760px]:col-span-2" data-field="links">
            <SubjectFormLinks v-model="form.links" describedby="subject-form-links-error" />
            <p v-if="messageOf('links') !== null" id="subject-form-links-error" class="mt-1 text-xs text-red">
              {{ t(messageOf('links') ?? '') }}
            </p>
          </div>

          <div class="min-[760px]:col-span-2">
            <SubjectFormDepends
              v-model="form.dependsOn"
              :subjects="subjects"
              :projects="projects"
              :self-id="subject?.id ?? null"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid min-[760px]:col-span-2" data-field="note">
            <label for="subject-form-note">{{ t('subjects.form.note') }}</label>
            <textarea
              id="subject-form-note"
              v-model="form.note"
              rows="3"
              class="rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
              :class="borderOf('note')"
              :placeholder="t('subjects.form.notePlaceholder')"
              :aria-invalid="invalid('note')"
              :aria-describedby="describedBy('note')"
              data-test-id="subject-form-note"
            />
            <p
              id="subject-form-note-error"
              class="text-xs"
              :class="invalid('note') ? 'text-red' : 'text-txt-low'"
            >
              {{ invalid('note') ? t(messageOf('note') ?? '') : t('subjects.form.noteCount', { count: form.note.length, limit: NOTE_LIMIT }) }}
            </p>
          </div>

          <div class="flex flex-col gap-2 min-[760px]:col-span-2" aria-live="polite">
            <p
              v-if="hasIssues"
              class="rounded-md px-3 py-2 text-sm text-txt-hi"
              role="alert"
              data-test-id="subject-form-summary"
            >
              {{ t('subjects.form.errors.summary', { count: issues.length }, issues.length) }}
            </p>
            <p
              v-if="refusal !== null"
              class="rounded-md px-3 py-2 text-sm text-txt-hi"
              role="alert"
              data-test-id="subject-form-refusal"
            >
              {{ say(refusal) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 min-[760px]:col-span-2">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-semibold text-txt-mid hover:bg-elev"
              data-test-id="subject-form-cancel"
              @click="leave"
            >
              {{ t('subjects.form.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="busy"
              class="rounded-md bg-acc px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
              data-test-id="subject-form-submit"
            >
              {{ t(editing ? 'subjects.form.save' : 'subjects.form.create') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
