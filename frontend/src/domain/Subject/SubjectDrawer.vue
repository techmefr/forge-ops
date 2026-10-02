<script setup lang="ts">
import { safeHref } from '@/technical/Ui/SafeHref'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import {
  EPIC_PRIORITIES,
  type EpicPriority,
  type EpicStateChange,
  type SubjectLink,
} from '@contract/EpicContract'
import type { ProjectEvent } from '@contract/EventContract'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { tintOf } from '@/technical/Ui/Tint'
import { STATE_TONES, dayLabel } from './SubjectFormat'
import { blockedDays } from './SubjectRule'

const NOTE_LIMIT = 600
const DAY_MS = 86400000

const props = defineProps<{
  subject: EpicOverview
  project: Project | null
  ownerName: string | null
  blocks: readonly EpicOverview[]
  today: string
}>()

const emit = defineEmits<{
  close: []
  changed: []
  edit: []
  open: [id: number]
}>()

const { t, locale } = useI18n()
const say = usePhrase()

const history = ref<readonly EpicStateChange[]>([])
const events = ref<readonly ProjectEvent[]>([])
const projectLinks = ref<readonly SubjectLink[]>([])
const note = ref('')
const refusal = ref<Phrase | null>(null)
const confirmingDeletion = ref(false)
const busy = ref(false)

const deleted = computed(() => props.subject.deletedAt !== null)
const blocked = computed(() => blockedDays(props.subject.blockedSince, props.today))

const trail = computed(() =>
  history.value.map((change, index) => {
    const next = history.value[index + 1]
    const end = next === undefined ? props.today : next.at.slice(0, 10)
    const days = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${change.at.slice(0, 10)}T00:00:00Z`)) / DAY_MS))
    return { ...change, days }
  }),
)

async function refresh(): Promise<void> {
  const id = props.subject.id
  const [changes, projectEvents, links] = await Promise.all([
    board.read<readonly EpicStateChange[]>(`/api/epics/${id}/history`).catch(() => []),
    board.read<readonly ProjectEvent[]>(`/api/projects/${props.subject.projectId}/events`).catch(() => []),
    board.read<readonly SubjectLink[]>(`/api/projects/${props.subject.projectId}/links`).catch(() => []),
  ])
  history.value = changes
  events.value = projectEvents.filter((event) => event.epicId === id)
  projectLinks.value = links
}

watch(
  () => props.subject.id,
  () => {
    note.value = props.subject.statusNote ?? ''
    refusal.value = null
    confirmingDeletion.value = false
    void refresh()
  },
  { immediate: true },
)

watch(
  () => [props.subject.statusNote, props.subject.dueOn],
  () => {
    note.value = props.subject.statusNote ?? ''
    void refresh()
  },
)

async function guard(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true
  refusal.value = null
  try {
    await action()
    return true
  } catch (error) {
    refusal.value = reasonOf(error)
    return false
  } finally {
    busy.value = false
  }
}

async function saveNote(): Promise<void> {
  const wanted = note.value.trim() === '' ? null : note.value.trim()
  if (wanted === props.subject.statusNote) {
    return
  }
  if (await guard(() => board.send(`/api/epics/${props.subject.id}`, 'PATCH', { statusNote: wanted }))) {
    emit('changed')
  }
}

async function changePriority(event: Event): Promise<void> {
  const priority = (event.target as HTMLSelectElement).value as EpicPriority
  if (await guard(() => board.send(`/api/epics/${props.subject.id}`, 'PATCH', { priority }))) {
    emit('changed')
  }
}

async function remove(): Promise<void> {
  if (!confirmingDeletion.value) {
    confirmingDeletion.value = true
    return
  }
  if (await guard(() => board.send(`/api/epics/${props.subject.id}`, 'DELETE'))) {
    emit('changed')
    emit('close')
  }
}

async function restore(): Promise<void> {
  if (await guard(() => board.send(`/api/epics/${props.subject.id}/restore`, 'POST'))) {
    emit('changed')
    emit('close')
  }
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
        class="fixed top-0 right-0 bottom-0 z-50 grid w-[min(520px,100vw)] content-start gap-3 overflow-y-auto border-l border-hair bg-panel p-5"
        data-test-id="subject-drawer"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="project !== null"
            class="inline-flex items-center gap-1 text-xs text-txt-mid"
          >
            <span
              class="size-2 flex-none rounded-full"
              :style="{ background: tintOf(project.colour) }"
              aria-hidden="true"
            />
            {{ project.name }}
          </span>
          <span
            v-for="tag in subject.tags"
            :key="tag.id"
            class="inline-flex items-center gap-1 text-xs text-txt-low"
          >
            <span class="size-2 flex-none rounded-full" :style="{ background: tintOf(tag.colour) }" aria-hidden="true" />
            #{{ tag.label }}
          </span>
          <button
            v-if="!deleted"
            type="button"
            class="ml-auto rounded-md px-2.5 py-1 text-xs font-semibold text-txt-hi hover:bg-elev"
            data-test-id="drawer-edit"
            @click="emit('edit')"
          >
            {{ t('subjects.drawer.edit') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-semibold text-txt-mid hover:bg-elev"
            :class="deleted ? 'ml-auto' : ''"
            data-test-id="drawer-close"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </div>

        <DialogTitle class="title-face text-sm text-txt-hi">{{ subject.title }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('subjects.drawer.description') }}</DialogDescription>

        <dl class="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <dt class="text-txt-low">{{ t('subjects.drawer.owner') }}</dt>
          <dd class="text-txt-hi">{{ ownerName ?? t('subjects.drawer.nobody') }}</dd>
          <dt class="text-txt-low">{{ t('subjects.drawer.state') }}</dt>
          <dd>
            <span class="font-semibold" :class="STATE_TONES[subject.state]">{{ t(`epicState.${subject.state}`) }}</span>
            <small v-if="subject.storyCount > 0" class="ml-2 text-txt-low">{{ t('subjects.row.derived') }}</small>
            <small v-if="blocked !== null && blocked > 0" class="ml-2 text-warn">{{ t('subjects.row.blockedFor', { days: blocked }) }}</small>
          </dd>
          <dt class="text-txt-low"><label for="drawer-priority">{{ t('subjects.drawer.priority') }}</label></dt>
          <dd>
            <select
              id="drawer-priority"
              class="rounded-md border border-line bg-transparent px-2 py-1 text-sm text-txt-hi"
              :value="subject.priority"
              :disabled="deleted || busy"
              @change="changePriority"
            >
              <option v-for="priority in EPIC_PRIORITIES" :key="priority" :value="priority">
                {{ t(`epicPriority.${priority}`) }}
              </option>
            </select>
          </dd>
          <dt class="text-txt-low">{{ t('subjects.drawer.requestedBy') }}</dt>
          <dd class="text-txt-hi">{{ subject.requestedBy ?? t('common.nothing') }}</dd>
          <dt class="text-txt-low">{{ t('subjects.drawer.start') }}</dt>
          <dd class="font-mono text-txt-hi">{{ subject.startedOn === null ? t('common.nothing') : dayLabel(subject.startedOn, locale) }}</dd>
          <dt class="text-txt-low">{{ t('subjects.drawer.milestone') }}</dt>
          <dd class="font-mono text-txt-hi">{{ subject.dueOn === null ? t('common.nothing') : dayLabel(subject.dueOn, locale) }}</dd>
          <dt class="text-txt-low">{{ t('subjects.drawer.progress') }}</dt>
          <dd class="font-mono text-txt-hi">
            {{ t('subjects.row.stories', { delivered: subject.progress.delivered, total: subject.progress.total }) }}
          </dd>
        </dl>

        <label class="flex flex-col gap-1 text-xs text-txt-low" for="drawer-note">
          {{ t('subjects.drawer.note') }}
        </label>
        <textarea
          id="drawer-note"
          v-model="note"
          rows="3"
          :maxlength="NOTE_LIMIT"
          :disabled="deleted"
          :placeholder="t('subjects.drawer.notePlaceholder')"
          class="min-h-[5.5rem] shrink-0 rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
          @change="saveNote"
        />

        <h3 class="text-xs text-txt-low">{{ t('subjects.drawer.dependencies') }}</h3>
        <div class="flex flex-col gap-1 text-sm text-txt-hi">
          <p>
            <span class="text-txt-low">{{ t('subjects.drawer.waitingOn') }}</span>
            <template v-if="subject.waitingOn.length > 0">
              <button
                v-for="waiting in subject.waitingOn"
                :key="waiting.id"
                type="button"
                class="ml-2 text-info underline"
                @click="emit('open', waiting.id)"
              >
                {{ waiting.title }}
              </button>
            </template>
            <span v-else class="ml-2">{{ t('subjects.drawer.none') }}</span>
          </p>
          <p>
            <span class="text-txt-low">{{ t('subjects.drawer.blocks') }}</span>
            <template v-if="blocks.length > 0">
              <button
                v-for="other in blocks"
                :key="other.id"
                type="button"
                class="ml-2 text-info underline"
                @click="emit('open', other.id)"
              >
                {{ other.title }}
              </button>
            </template>
            <span v-else class="ml-2">{{ t('subjects.drawer.none') }}</span>
          </p>
        </div>

        <h3 class="text-xs text-txt-low">{{ t('subjects.drawer.events') }}</h3>
        <ul v-if="events.length > 0" class="flex flex-col gap-1 text-sm text-txt-hi">
          <li v-for="event in events" :key="event.id">
            <span class="font-mono">{{ dayLabel(event.date, locale) }}</span>
            · {{ t(`milestone.${event.type}`) }}<template v-if="event.title !== ''"> · {{ event.title }}</template>
          </li>
        </ul>
        <p v-else class="text-sm text-txt-low">{{ t('subjects.drawer.none') }}</p>

        <h3 class="text-xs text-txt-low">{{ t('subjects.drawer.history') }}</h3>
        <ol v-if="trail.length > 0" class="flex flex-col gap-1 text-sm text-txt-hi" data-test-id="subject-history">
          <li v-for="(change, index) in trail" :key="index">
            <span class="font-mono text-txt-mid">{{ dayLabel(change.at.slice(0, 10), locale) }}</span>
            · <span class="font-semibold" :class="STATE_TONES[change.state]">{{ t(`epicState.${change.state}`) }}</span>
            · {{ t('subjects.drawer.historyBy', { by: change.by, days: change.days }) }}
          </li>
        </ol>
        <p v-else class="text-sm text-txt-low">{{ t('subjects.drawer.none') }}</p>

        <h3 class="text-xs text-txt-low">{{ t('subjects.drawer.subjectLinks') }}</h3>
        <ul v-if="subject.links.length > 0" class="flex flex-wrap gap-2">
          <li v-for="link in subject.links" :key="`${link.kind}-${link.url}`">
            <a
              :href="safeHref(link.url)"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-md px-2 py-0.5 text-xs text-info hover:bg-elev max-sm:inline-flex max-sm:min-h-10 max-sm:min-w-10 max-sm:items-center max-sm:justify-center"
            >
              {{ t(`linkKind.${link.kind}`) }}<span class="sr-only"> {{ t('team.opensNewTab') }}</span>
            </a>
          </li>
        </ul>
        <p v-else class="text-sm text-txt-low">{{ t('subjects.drawer.none') }}</p>

        <h3 class="text-xs text-txt-low">
          {{ t('subjects.drawer.projectLinks', { project: project?.name ?? '' }) }}
        </h3>
        <ul v-if="projectLinks.length > 0" class="flex flex-wrap gap-2">
          <li v-for="link in projectLinks" :key="`${link.kind}-${link.url}`">
            <a
              :href="safeHref(link.url)"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-md px-2 py-0.5 text-xs text-info hover:bg-elev max-sm:inline-flex max-sm:min-h-10 max-sm:min-w-10 max-sm:items-center max-sm:justify-center"
            >
              {{ t(`linkKind.${link.kind}`) }}<span class="sr-only"> {{ t('team.opensNewTab') }}</span>
            </a>
          </li>
        </ul>
        <p v-else class="text-sm text-txt-low">{{ t('subjects.drawer.none') }}</p>

        <p
          v-if="refusal !== null"
          class="rounded-md px-3 py-2 text-sm text-txt-hi"
          role="alert"
        >
          {{ say(refusal) }}
        </p>

        <div class="flex flex-wrap gap-2 pt-2">
          <button
            v-if="deleted"
            type="button"
            :disabled="busy"
            class="rounded-md bg-acc px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
            data-test-id="drawer-restore"
            @click="restore"
          >
            {{ t('subjects.row.restore') }}
          </button>
          <button
            v-else
            type="button"
            :disabled="busy"
            class="rounded-md px-3 py-1.5 text-xs font-semibold text-red disabled:opacity-40"
            data-test-id="drawer-delete"
            @click="remove"
          >
            {{ t(confirmingDeletion ? 'subjects.drawer.confirmDelete' : 'subjects.drawer.delete') }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
