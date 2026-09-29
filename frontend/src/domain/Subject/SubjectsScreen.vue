<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUBJECT_FILTERS, type ManualEpicState, type SubjectFilter } from '@contract/EpicContract'
import type { EpicOverview } from '@/domain/Board/BoardModel'
import { localDay } from '@/domain/Roadmap/Timeline'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { readPreference, writePreference } from '@/technical/Appearance/Preference'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import NewSubjectDialog from './NewSubjectDialog.vue'
import SubjectDrawer from './SubjectDrawer.vue'
import SubjectRow from './SubjectRow.vue'
import { initialsOfLogin } from './SubjectFormat'
import {
  VIEWS,
  VIEW_ALL,
  VIEW_LATE,
  VIEW_NONE,
  filterCounts,
  flagsOf,
  loadOf,
  loadText,
  loadTone,
  narrow,
  stepSelection,
  subjectsOfView,
  viewCounts,
  type Facet,
} from './SubjectRule'
import { useSubjects } from './UseSubjects'

const SELECTION_KEY = 'forge.subjects.selection'
const PROJECT_KEY = 'forge.subjects.project'
const ALL = 'all'

const { t } = useI18n()
const say = usePhrase()

const subjects = useSubjects()
const today = ref(localDay(new Date()))
const selection = ref(VIEW_ALL)
const filter = ref<SubjectFilter>('open')
const projectChoice = ref(ALL)
const tagChoice = ref(ALL)
const search = ref('')
const refusal = ref<Phrase | null>(null)
const openId = ref<number | null>(null)
const creating = ref(false)
const peopleRoot = ref<HTMLElement | null>(null)

const data = computed(() => subjects.data.value)
const live = computed(() => data.value?.live ?? [])
const trash = computed(() => data.value?.trash ?? [])
const people = computed(() => data.value?.people ?? [])
const projects = computed(() => data.value?.projects ?? [])
const self = computed(() => data.value?.self ?? null)

const facet = computed<Facet>(() => ({
  project: projectChoice.value === ALL ? null : Number(projectChoice.value),
  tag: tagChoice.value === ALL ? null : Number(tagChoice.value),
  q: search.value,
}))

const narrowedLive = computed(() => narrow(live.value, facet.value))
const narrowedTrash = computed(() => narrow(trash.value, facet.value))
const order = computed(() => [...VIEWS, ...people.value.map((person) => person.login)])
const counts = computed(() => viewCounts(narrowedLive.value))
const stateCounts = computed(() => filterCounts(narrowedLive.value, narrowedTrash.value))
const visible = computed(() =>
  subjectsOfView(selection.value, narrowedLive.value, narrowedTrash.value, filter.value),
)

const rows = computed(() =>
  people.value.map((person) => {
    const load = loadOf(live.value, person.login)
    return {
      person,
      load,
      text: loadText(load, person.capacity),
      tone: loadTone(load, person.capacity),
      flags: flagsOf(narrowedLive.value, person.login),
    }
  }),
)

const deletedView = computed(() => selection.value === VIEW_ALL && filter.value === 'trash')
const showOwner = computed(() => selection.value === VIEW_ALL || selection.value === VIEW_LATE)
const opened = computed(
  () => [...live.value, ...trash.value].find((subject) => subject.id === openId.value) ?? null,
)

const blocksOfOpened = computed(() =>
  live.value.filter((other) => opened.value !== null && other.dependsOn.includes(opened.value.id)),
)

const heading = computed(() => {
  if (selection.value === VIEW_ALL) {
    return t('subjects.viewAll')
  }
  if (selection.value === VIEW_LATE) {
    return t('subjects.viewLate')
  }
  if (selection.value === VIEW_NONE) {
    return t('subjects.viewNone')
  }
  return nameOf(selection.value)
})

const summary = computed(() => {
  if (selection.value === VIEW_LATE) {
    return t('subjects.sub.late')
  }
  if (selection.value === VIEW_NONE) {
    return t('subjects.sub.none')
  }
  if (selection.value === VIEW_ALL) {
    return t('subjects.sub.all', { count: visible.value.length }, visible.value.length)
  }
  const late = visible.value.filter((subject) => subject.lateDays !== null).length
  const blocked = visible.value.filter((subject) => subject.state === 'blocked').length
  return [
    t('subjects.sub.open', { count: visible.value.length }, visible.value.length),
    late > 0 ? t('subjects.flagLate', { count: late }, late) : null,
    blocked > 0 ? t('subjects.flagBlocked', { count: blocked }, blocked) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')
})

function nameOf(login: string): string {
  return people.value.find((person) => person.login === login)?.displayName ?? login
}

function ownerOf(subject: EpicOverview): string | null {
  return subject.assignee === null ? null : nameOf(subject.assignee)
}

function projectOf(subject: EpicOverview) {
  return projects.value.find((project) => project.id === subject.projectId) ?? null
}

function select(view: string): void {
  if (view === VIEW_ALL && selection.value !== VIEW_ALL) {
    filter.value = 'open'
  }
  selection.value = view
  writePreference(SELECTION_KEY, view)
}

function focusSelected(): void {
  const buttons = peopleRoot.value?.querySelectorAll<HTMLElement>('[data-selection]') ?? []
  Array.from(buttons)
    .find((button) => button.dataset.selection === selection.value)
    ?.focus()
}

async function moveWithArrows(event: KeyboardEvent): Promise<void> {
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
  if (!forward && !backward) {
    return
  }
  event.preventDefault()
  select(stepSelection(order.value, selection.value, forward ? 1 : -1))
  await nextTick()
  focusSelected()
}

function chooseProject(event: Event): void {
  projectChoice.value = (event.target as HTMLSelectElement).value
  writePreference(PROJECT_KEY, projectChoice.value)
}

async function run(action: () => Promise<void>): Promise<void> {
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  }
  await subjects.reload()
}

function take(subject: EpicOverview): Promise<void> {
  return run(async () => {
    await board.send(`/api/epics/${subject.id}/claim`, 'POST')
    if (subject.storyCount === 0 && subject.state === 'todo') {
      await board.send(`/api/epics/${subject.id}`, 'PATCH', { state: 'doing' })
    }
    if (self.value !== null && order.value.includes(self.value)) {
      select(self.value)
    }
  })
}

function release(subject: EpicOverview): Promise<void> {
  return run(async () => {
    await board.send(`/api/epics/${subject.id}/claim`, 'DELETE')
    if (subject.storyCount === 0 && subject.state === 'doing') {
      await board.send(`/api/epics/${subject.id}`, 'PATCH', { state: 'todo' })
    }
  })
}

function restore(subject: EpicOverview): Promise<void> {
  return run(async () => {
    await board.send(`/api/epics/${subject.id}/restore`, 'POST')
  })
}

function changeState(subject: EpicOverview, state: ManualEpicState): Promise<void> {
  return run(async () => {
    await board.send(`/api/epics/${subject.id}`, 'PATCH', { state })
  })
}

async function created(id: number): Promise<void> {
  creating.value = false
  await subjects.reload()
  select(VIEW_ALL)
  filter.value = 'open'
  openId.value = id
}

function loadDescription(row: (typeof rows.value)[number]): string {
  const base =
    row.person.capacity === null
      ? t('subjects.loadAlone', { load: row.load }, row.load)
      : t('subjects.loadOf', { load: row.load, capacity: row.person.capacity }, row.load)
  if (row.tone === 'full') {
    return `${base}, ${t('subjects.atCapacity')}`
  }
  return row.tone === 'over' ? `${base}, ${t('subjects.overCapacity')}` : base
}

const TONE_CLASSES = {
  neutral: 'border-line text-txt-mid',
  full: 'border-orange text-orange',
  over: 'border-red text-red',
} as const

watch(
  () => data.value,
  (loaded, before) => {
    if (loaded === null || before !== null) {
      return
    }
    const wanted = readPreference(SELECTION_KEY, order.value, self.value !== null && order.value.includes(self.value) ? self.value : VIEW_ALL)
    selection.value = wanted
    projectChoice.value = readPreference(PROJECT_KEY, [ALL, ...loaded.projects.map((project) => String(project.id))], ALL)
    const wantedTag = new URLSearchParams(window.location.search).get('tag')
    if (wantedTag !== null && loaded.tags.some((tag) => String(tag.id) === wantedTag)) {
      tagChoice.value = wantedTag
    }
  },
)

watch(opened, (found) => {
  if (found === null) {
    openId.value = null
  }
})

onMounted(() => {
  today.value = localDay(new Date())
  return subjects.reload()
})
</script>

<template>
  <div
    class="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6"
    data-test-id="subjects-screen"
  >
    <div class="flex flex-none flex-wrap items-center gap-3" role="search" :aria-label="t('subjects.toolbar.aria')">
      <label class="flex items-center gap-2 text-xs text-txt-mid" for="subjects-project">
        {{ t('subjects.toolbar.project') }}
        <select
          id="subjects-project"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          :value="projectChoice"
          data-test-id="subjects-project"
          @change="chooseProject"
        >
          <option :value="ALL">{{ t('subjects.toolbar.allProjects') }}</option>
          <option v-for="project in projects" :key="project.id" :value="String(project.id)">
            {{ project.name }}
          </option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs text-txt-mid" for="subjects-tag">
        {{ t('subjects.toolbar.tag') }}
        <select
          id="subjects-tag"
          v-model="tagChoice"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          data-test-id="subjects-tag"
        >
          <option :value="ALL">{{ t('subjects.toolbar.allTags') }}</option>
          <option v-for="tag in data?.tags ?? []" :key="tag.id" :value="String(tag.id)">
            {{ tag.label }}
          </option>
        </select>
      </label>
      <input
        v-model="search"
        type="search"
        class="min-w-48 flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi sm:max-w-sm"
        :placeholder="t('subjects.toolbar.searchPlaceholder')"
        :aria-label="t('subjects.toolbar.search')"
        data-test-id="subjects-search"
      />
      <button
        type="button"
        class="ml-auto rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase"
        data-test-id="subjects-new"
        @click="creating = true"
      >
        {{ t('subjects.toolbar.newSubject') }}
      </button>
    </div>

    <p
      v-if="refusal !== null"
      class="rounded-lg border border-red bg-red-soft/10 p-3 text-sm text-txt-hi"
      role="alert"
      data-test-id="subjects-refusal"
    >
      {{ say(refusal) }}
    </p>

    <ScreenState
      :pending="subjects.pending.value && subjects.data.value === null"
      :failure="subjects.failure.value"
      :empty="data !== null && projects.length === 0"
      empty-key="subjects.empty"
      @retry="subjects.reload()"
    >
      <div class="grid flex-none grid-cols-1 items-start gap-4 min-[760px]:grid-cols-[260px_1fr]">
        <div
          ref="peopleRoot"
          class="flex min-w-0 flex-row gap-1 overflow-x-auto rounded-lg border border-line bg-card p-2 min-[760px]:flex-col min-[760px]:overflow-x-visible"
          role="group"
          :aria-label="t('subjects.teamAria')"
          data-test-id="subjects-people"
          @keydown="moveWithArrows"
        >
          <h3 class="hidden px-2 pt-1 font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase min-[760px]:block">
            {{ t('subjects.views') }}
          </h3>
          <button
            type="button"
            class="flex flex-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm min-[760px]:w-full"
            :class="selection === VIEW_ALL ? 'border-acc bg-elev text-txt-hi' : 'border-transparent text-txt-mid hover:bg-elev'"
            :tabindex="selection === VIEW_ALL ? 0 : -1"
            :aria-current="selection === VIEW_ALL ? 'true' : undefined"
            :data-selection="VIEW_ALL"
            data-test-id="view-all"
            @click="select(VIEW_ALL)"
          >
            <span class="flex size-6 flex-none items-center justify-center rounded-full bg-line text-xs font-bold" aria-hidden="true">*</span>
            <span class="flex-1 whitespace-nowrap">{{ t('subjects.viewAll') }}</span>
            <span class="font-mono text-xs" data-test-id="count-all">{{ counts.all }}</span>
          </button>
          <button
            type="button"
            class="flex flex-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm min-[760px]:w-full"
            :class="selection === VIEW_LATE ? 'border-acc bg-elev text-txt-hi' : 'border-transparent text-txt-mid hover:bg-elev'"
            :tabindex="selection === VIEW_LATE ? 0 : -1"
            :aria-current="selection === VIEW_LATE ? 'true' : undefined"
            :data-selection="VIEW_LATE"
            data-test-id="view-late"
            @click="select(VIEW_LATE)"
          >
            <span class="flex size-6 flex-none items-center justify-center rounded-full bg-line text-xs font-bold text-red" aria-hidden="true">!</span>
            <span class="flex-1 whitespace-nowrap">{{ t('subjects.viewLate') }}</span>
            <span class="font-mono text-xs" data-test-id="count-late">{{ counts.late }}</span>
          </button>
          <button
            type="button"
            class="flex flex-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm min-[760px]:w-full"
            :class="selection === VIEW_NONE ? 'border-acc bg-elev text-txt-hi' : 'border-transparent text-txt-mid hover:bg-elev'"
            :tabindex="selection === VIEW_NONE ? 0 : -1"
            :aria-current="selection === VIEW_NONE ? 'true' : undefined"
            :data-selection="VIEW_NONE"
            data-test-id="view-none"
            @click="select(VIEW_NONE)"
          >
            <span class="flex size-6 flex-none items-center justify-center rounded-full bg-line text-xs font-bold" aria-hidden="true">?</span>
            <span class="flex-1 whitespace-nowrap">{{ t('subjects.viewNone') }}</span>
            <span class="font-mono text-xs" data-test-id="count-none">{{ counts.none }}</span>
          </button>

          <h3 class="hidden px-2 pt-3 font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase min-[760px]:block">
            {{ t('subjects.team') }}
          </h3>
          <button
            v-for="row in rows"
            :key="row.person.login"
            type="button"
            class="flex flex-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm min-[760px]:w-full"
            :class="selection === row.person.login ? 'border-acc bg-elev text-txt-hi' : 'border-transparent text-txt-mid hover:bg-elev'"
            :tabindex="selection === row.person.login ? 0 : -1"
            :aria-current="selection === row.person.login ? 'true' : undefined"
            :data-selection="row.person.login"
            :data-test-id="`person-${row.person.login}`"
            @click="select(row.person.login)"
          >
            <span class="flex size-6 flex-none items-center justify-center rounded-full bg-line text-[10px] font-bold" aria-hidden="true">
              {{ initialsOfLogin(row.person.displayName) }}
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate whitespace-nowrap">
                {{ row.person.displayName }}<template v-if="row.person.login === self"> {{ t('subjects.me') }}</template>
              </span>
              <span v-if="row.flags.late > 0 || row.flags.blocked > 0" class="flex flex-wrap gap-x-2 text-[11px] font-semibold">
                <span v-if="row.flags.late > 0" class="whitespace-nowrap text-red" data-test-id="flag-late">
                  {{ t('subjects.flagLate', { count: row.flags.late }, row.flags.late) }}
                </span>
                <span v-if="row.flags.blocked > 0" class="whitespace-nowrap text-warn" data-test-id="flag-blocked">
                  {{ t('subjects.flagBlocked', { count: row.flags.blocked }, row.flags.blocked) }}
                </span>
              </span>
            </span>
            <span
              class="flex-none rounded border px-1.5 py-0.5 font-mono text-xs font-bold"
              :class="TONE_CLASSES[row.tone]"
              :title="loadDescription(row)"
              :data-tone="row.tone"
              data-test-id="load-chip"
            >
              <span aria-hidden="true">{{ row.text }}</span>
              <span class="sr-only">{{ loadDescription(row) }}</span>
            </span>
          </button>
          <p class="hidden px-2 pt-2 text-[11px] text-txt-low min-[760px]:block">{{ t('subjects.hint') }}</p>
        </div>

        <section class="min-w-0 rounded-lg border border-line bg-card" :aria-label="heading">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-3">
            <h2 class="display-italic text-lg text-txt-hi uppercase" data-test-id="list-title">{{ heading }}</h2>
            <p class="text-xs text-txt-mid" aria-live="polite" data-test-id="list-summary">{{ summary }}</p>
          </div>
          <div
            v-if="selection === VIEW_ALL"
            class="flex flex-wrap gap-2 border-b border-line px-4 py-3"
            role="group"
            :aria-label="t('subjects.filterGroup')"
          >
            <button
              v-for="option in SUBJECT_FILTERS"
              :key="option"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-semibold"
              :class="filter === option ? 'border-acc bg-acc text-ink' : 'border-line text-txt-mid hover:border-acc'"
              :aria-pressed="filter === option"
              :data-test-id="`filter-${option}`"
              @click="filter = option"
            >
              {{ t(`subjectFilter.${option}`) }}
              <span class="ml-1 font-mono">{{ stateCounts[option] }}</span>
            </button>
          </div>
          <p v-if="visible.length === 0" class="px-4 py-6 text-sm text-txt-low" data-test-id="list-empty">
            {{ t('subjects.emptyList') }}
          </p>
          <ul v-else data-test-id="subjects-list">
            <SubjectRow
              v-for="subject in visible"
              :key="subject.id"
              :subject="subject"
              :project="projectOf(subject)"
              :owner-name="ownerOf(subject)"
              :show-owner="showOwner"
              :today="today"
              :self="self"
              :deleted="deletedView"
              @open="openId = $event"
              @take="take"
              @release="release"
              @restore="restore"
              @state="changeState"
            />
          </ul>
        </section>
      </div>
    </ScreenState>

    <SubjectDrawer
      v-if="opened !== null"
      :subject="opened"
      :project="projectOf(opened)"
      :owner-name="ownerOf(opened)"
      :blocks="blocksOfOpened"
      :today="today"
      @close="openId = null"
      @changed="subjects.reload()"
      @open="openId = $event"
    />
    <NewSubjectDialog
      v-if="creating"
      :projects="projects"
      :project-id="facet.project"
      @close="creating = false"
      @saved="created"
    />
  </div>
</template>
