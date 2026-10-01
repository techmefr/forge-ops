<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUBJECT_FILTERS, type ManualEpicState, type SubjectFilter } from '@contract/EpicContract'
import type { EpicOverview } from '@/domain/Board/BoardModel'
import WeatherCards from '@/domain/FollowUp/WeatherCards.vue'
import { localDay } from '@/domain/Roadmap/Timeline'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { readPreference, writePreference } from '@/technical/Appearance/Preference'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import ProjectPicker from '@/domain/Project/ProjectPicker.vue'
import SubjectFormDialog from './SubjectFormDialog.vue'
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
const editing = ref(false)
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

const viewRows = computed(() => [
  { key: VIEW_ALL, label: t('subjects.viewAll'), glyph: '*', count: counts.value.all, testId: 'view-all', countId: 'count-all' },
  { key: VIEW_LATE, label: t('subjects.viewLate'), glyph: '!', count: counts.value.late, testId: 'view-late', countId: 'count-late' },
  { key: VIEW_NONE, label: t('subjects.viewNone'), glyph: '?', count: counts.value.none, testId: 'view-none', countId: 'count-none' },
])

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

function chooseProject(projectId: number | null): void {
  projectChoice.value = projectId === null ? ALL : String(projectId)
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
    const startsNow = subject.storyCount === 0 && subject.state === 'todo'
    await board.send(`/api/epics/${subject.id}/claim`, 'POST', startsNow ? { state: 'doing' } : undefined)
    if (self.value !== null && order.value.includes(self.value)) {
      select(self.value)
    }
  })
}

function release(subject: EpicOverview): Promise<void> {
  return run(async () => {
    const backToTodo = subject.storyCount === 0 && subject.state === 'doing'
    await board.send(`/api/epics/${subject.id}/claim${backToTodo ? '?state=todo' : ''}`, 'DELETE')
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

async function edited(id: number): Promise<void> {
  editing.value = false
  await subjects.reload()
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
  neutral: 'text-txt-low',
  full: 'text-orange',
  over: 'text-red',
} as const

const SELECTED_CLASSES = 'text-txt-hi shadow-[inset_2px_0_0_0_var(--color-acc)]'

const IDLE_CLASSES = 'text-txt-mid hover:bg-elev/60'

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
    class="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-8"
    data-test-id="subjects-screen"
  >
    <div
      class="flex flex-none flex-wrap items-center gap-2"
      role="search"
      :aria-label="t('subjects.toolbar.aria')"
    >
      <div class="flex items-center gap-1.5 text-[11px] text-txt-low">
        <label for="subjects-project">{{ t('subjects.toolbar.project') }}</label>
        <div class="w-48">
          <ProjectPicker
            id="subjects-project"
            :model-value="projectChoice === ALL ? null : Number(projectChoice)"
            :projects="projects"
            :all-label="t('subjects.toolbar.allProjects')"
            test-id="subjects-project"
            @update:model-value="chooseProject"
            @created="subjects.reload()"
          />
        </div>
      </div>
      <label class="flex items-center gap-1.5 text-[11px] text-txt-low" for="subjects-tag">
        {{ t('subjects.toolbar.tag') }}
        <select
          id="subjects-tag"
          v-model="tagChoice"
          class="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
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
        class="min-w-40 flex-1 rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi sm:max-w-sm"
        :placeholder="t('subjects.toolbar.searchPlaceholder')"
        :aria-label="t('subjects.toolbar.search')"
        data-test-id="subjects-search"
      />
      <button
        type="button"
        class="ml-auto rounded-md bg-acc px-3 py-1.5 text-[11px] font-semibold text-ink uppercase"
        data-test-id="subjects-new"
        @click="creating = true"
      >
        {{ t('subjects.toolbar.newSubject') }}
      </button>
    </div>

    <WeatherCards :project-id="facet.project" />

    <p
      v-if="refusal !== null"
      class="rounded-md border border-red px-3 py-2 text-sm text-txt-hi"
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
      <div class="grid flex-none grid-cols-[minmax(0,1fr)] items-start gap-4 min-[760px]:grid-cols-[232px_1fr] min-[760px]:gap-8">
        <div
          ref="peopleRoot"
          class="relative flex min-w-0 flex-row gap-0.5 overflow-x-auto border-b border-line pb-2 min-[760px]:flex-col min-[760px]:overflow-x-visible min-[760px]:border-r min-[760px]:border-b-0 min-[760px]:pr-4 min-[760px]:pb-0"
          role="group"
          :aria-label="t('subjects.teamAria')"
          data-test-id="subjects-people"
          @keydown="moveWithArrows"
        >
          <h2 class="hidden px-2.5 pb-1 text-[11px] tracking-wider text-txt-low uppercase min-[760px]:block">
            {{ t('subjects.views') }}
          </h2>
          <button
            v-for="view in viewRows"
            :key="view.key"
            type="button"
            class="flex min-h-10 flex-none items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm min-[760px]:min-h-0 min-[760px]:w-full"
            :class="selection === view.key ? SELECTED_CLASSES : IDLE_CLASSES"
            :tabindex="selection === view.key ? 0 : -1"
            :aria-current="selection === view.key ? 'true' : undefined"
            :data-selection="view.key"
            :data-test-id="view.testId"
            @click="select(view.key)"
          >
            <span
              class="flex size-5 flex-none items-center justify-center rounded-full bg-elev text-[11px] font-semibold text-txt-hi"
              :class="view.key === VIEW_LATE ? 'text-red' : 'text-txt-mid'"
              aria-hidden="true"
            >
              {{ view.glyph }}
            </span>
            <span class="flex-1 whitespace-nowrap">{{ view.label }}</span>
            <span class="font-mono text-[11px] text-txt-low" :data-test-id="view.countId">{{ view.count }}</span>
          </button>

          <h2 class="hidden px-2.5 pt-4 pb-1 text-[11px] tracking-wider text-txt-low uppercase min-[760px]:block">
            {{ t('subjects.team') }}
          </h2>
          <button
            v-for="row in rows"
            :key="row.person.login"
            type="button"
            class="flex min-h-10 flex-none items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm min-[760px]:min-h-0 min-[760px]:w-full"
            :class="selection === row.person.login ? SELECTED_CLASSES : IDLE_CLASSES"
            :tabindex="selection === row.person.login ? 0 : -1"
            :aria-current="selection === row.person.login ? 'true' : undefined"
            :data-selection="row.person.login"
            :data-test-id="`person-${row.person.login}`"
            @click="select(row.person.login)"
          >
            <span
              class="flex size-5 flex-none items-center justify-center rounded-full bg-elev text-[11px] font-semibold text-txt-mid"
              aria-hidden="true"
            >
              {{ initialsOfLogin(row.person.displayName) }}
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate whitespace-nowrap">
                {{ row.person.displayName }}<span v-if="row.person.login === self" class="ml-1 text-txt-low">{{ t('subjects.me') }}</span><span v-if="!row.person.active" class="ml-1 text-txt-low" data-test-id="person-inactive">{{ t('team.inactive') }}</span>
              </span>
              <span
                v-if="row.flags.late > 0 || row.flags.blocked > 0"
                class="flex flex-wrap gap-x-2 text-[11px]"
              >
                <span v-if="row.flags.late > 0" class="whitespace-nowrap text-red" data-test-id="flag-late">
                  {{ t('subjects.flagLate', { count: row.flags.late }, row.flags.late) }}
                </span>
                <span v-if="row.flags.blocked > 0" class="whitespace-nowrap text-warn" data-test-id="flag-blocked">
                  {{ t('subjects.flagBlocked', { count: row.flags.blocked }, row.flags.blocked) }}
                </span>
              </span>
            </span>
            <span
              class="flex-none rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold"
              :class="TONE_CLASSES[row.tone]"
              :title="loadDescription(row)"
              :data-tone="row.tone"
              data-test-id="load-chip"
            >
              <span aria-hidden="true">{{ row.text }}</span>
              <span class="sr-only">{{ loadDescription(row) }}</span>
            </span>
          </button>
          <p class="hidden px-2.5 pt-4 text-[11px] text-txt-low min-[760px]:block">{{ t('subjects.hint') }}</p>
        </div>

        <section class="min-w-0" :aria-label="heading">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
            <h2 class="display-italic text-[13px] text-txt-hi uppercase" data-test-id="list-title">{{ heading }}</h2>
            <p class="text-[11px] text-txt-low" aria-live="polite" data-test-id="list-summary">{{ summary }}</p>
          </div>
          <div
            v-if="selection === VIEW_ALL"
            class="flex flex-wrap gap-1 py-2"
            role="group"
            :aria-label="t('subjects.filterGroup')"
          >
            <button
              v-for="option in SUBJECT_FILTERS"
              :key="option"
              type="button"
              class="rounded-md px-2.5 py-1 text-[11px] font-semibold"
              :class="filter === option ? 'bg-elev text-txt-hi' : 'text-txt-low hover:bg-elev/60 hover:text-txt-mid'"
              :aria-pressed="filter === option"
              :data-test-id="`filter-${option}`"
              @click="filter = option"
            >
              {{ t(`subjectFilter.${option}`) }}
              <span class="ml-1 font-mono font-normal">{{ stateCounts[option] }}</span>
            </button>
          </div>
          <p v-if="visible.length === 0" class="py-6 text-sm text-txt-low" data-test-id="list-empty">
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
      @edit="editing = true"
    />
    <SubjectFormDialog
      v-if="creating"
      :subject="null"
      :projects="projects"
      :project-id="facet.project"
      :people="people"
      :tags="data?.tags ?? []"
      :subjects="live"
      @close="creating = false"
      @changed="subjects.reload()"
      @saved="created"
    />
    <SubjectFormDialog
      v-if="editing && opened !== null"
      :subject="opened"
      :projects="projects"
      :project-id="opened.projectId"
      :people="people"
      :tags="data?.tags ?? []"
      :subjects="live"
      @close="editing = false"
      @changed="subjects.reload()"
      @saved="edited"
    />
  </div>
</template>
