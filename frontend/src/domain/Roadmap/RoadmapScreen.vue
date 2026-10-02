<script setup lang="ts">
import { safeHref } from '@/technical/Ui/SafeHref'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import { tintOf } from '@/technical/Ui/Tint'
import { minutesToWrite, type ProjectEvent } from '@contract/EventContract'
import WeatherCards from '@/domain/FollowUp/WeatherCards.vue'
import EventDialog from './EventDialog.vue'
import { EVENT_TONES } from './EventTone'
import {
  barOf,
  extentOf,
  labelPlacement,
  labelWidthPercent,
  lanesOf,
  localDay,
  percentOf,
  subjectsWithoutDates,
  ticksOf,
  upcomingOf,
  windowOf,
  type Extent,
  type LabelPlacement,
  type RoadmapSubject,
  type SubjectBar,
} from './Timeline'
import { useRoadmap, type RoadmapProject } from './UseRoadmap'

const LANE_HEIGHT_PX = 16
const DEFAULT_TRACK_PX = 900

const trackPx = ref(DEFAULT_TRACK_PX)
let trackObserver: ResizeObserver | undefined

function watchTrack(element: unknown): void {
  if (!(element instanceof HTMLElement) || trackObserver !== undefined) {
    return
  }
  const measure = (): void => {
    trackPx.value = element.clientWidth || DEFAULT_TRACK_PX
  }
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    trackObserver = new ResizeObserver(measure)
    trackObserver.observe(element)
  }
}

onBeforeUnmount(() => trackObserver?.disconnect())
const BAND_BASE_PX = 44
const BAND_LABEL_TOP_PX = 30
const UPCOMING_LIMIT = 8

type SubjectRow = {
  subject: RoadmapSubject
  bar: SubjectBar
  extent: Extent
  placement: LabelPlacement
  events: readonly ProjectEvent[]
  toWrite: boolean
}

type ProjectBlock = {
  entry: RoadmapProject
  rows: readonly SubjectRow[]
  undated: readonly RoadmapSubject[]
  lateCount: number
  toWriteCount: number
  lanes: ReadonlyMap<number, number>
  height: number
}

const { t, locale } = useI18n()

const roadmap = useRoadmap()
const cards = ref<InstanceType<typeof WeatherCards> | null>(null)
const today = ref(localDay(new Date()))
const dialog = ref<{
  event: ProjectEvent | null
  projectId: number | null
  epicId: number | null
} | null>(null)

const projects = computed(() => roadmap.data.value ?? [])

const view = computed(() => {
  const days = projects.value.flatMap((entry) => [
    ...entry.events.map((event) => event.date),
    ...entry.subjects.flatMap((subject) => (subject.startedOn === null ? [] : [subject.startedOn])),
  ])
  return windowOf(days, today.value)
})

const ticks = computed(() => ticksOf(view.value))
const todayLeft = computed(() => percentOf(today.value, view.value))
const upcoming = computed(() =>
  upcomingOf(
    projects.value.flatMap((entry) => entry.events),
    today.value,
    UPCOMING_LIMIT,
  ),
)

function rowsOf(entry: RoadmapProject): readonly SubjectRow[] {
  return entry.subjects
    .flatMap((subject) => {
      const bar = barOf(subject, entry.events, today.value)
      if (bar === null) {
        return []
      }
      const extent = extentOf(bar, view.value)
      const events = entry.events.filter((event) => event.epicId === subject.id)
      return [
        {
          subject,
          bar,
          extent,
          placement: labelPlacement(extent),
          events,
          toWrite: events.some((event) => minutesToWrite(event, today.value)),
        },
      ]
    })
    .sort((one, other) => one.bar.start.localeCompare(other.bar.start))
}

const blocks = computed<readonly ProjectBlock[]>(() =>
  projects.value.map((entry) => {
    const rows = rowsOf(entry)
    const widths = new Map(
      entry.events.map((event) => [event.id, labelWidthPercent(typeLabel(event), trackPx.value)] as const),
    )
    const lanes = lanesOf(entry.events, view.value, widths)
    return {
      entry,
      rows,
      undated: subjectsWithoutDates(entry.subjects, entry.events, today.value),
      lateCount: rows.filter((row) => row.bar.lateDays > 0).length,
      toWriteCount: entry.events.filter((event) => minutesToWrite(event, today.value)).length,
      lanes,
      height: BAND_BASE_PX + Math.max(0, ...lanes.values()) * LANE_HEIGHT_PX,
    }
  }),
)

const withoutDates = computed(() => blocks.value.filter((block) => block.undated.length > 0))

function dayLabel(day: string, withYear = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
}

function typeLabel(event: ProjectEvent): string {
  return t(`milestone.${event.type}`)
}

function eventName(event: ProjectEvent): string {
  return event.title === '' ? typeLabel(event) : event.title
}

function eventLabel(event: ProjectEvent): string {
  const base = t('roadmap.eventLabel', {
    type: typeLabel(event),
    title: eventName(event),
    date: dayLabel(event.date, true),
  })
  return minutesToWrite(event, today.value) ? `${base}, ${t('roadmap.minutesToWrite')}` : base
}

function daysLeftLabel(daysLeft: number): string {
  return daysLeft === 0 ? t('roadmap.today') : t('roadmap.inDays', { days: daysLeft })
}

function ownerOf(subject: RoadmapSubject): string {
  return subject.assignee ?? t('roadmap.nobody')
}

function projectNameOf(event: ProjectEvent): string {
  return projects.value.find((entry) => entry.project.id === event.projectId)?.project.name ?? ''
}

function barText(row: SubjectRow): string {
  const late = row.bar.lateDays > 0 ? ` · ${t('roadmap.lateBy', { days: row.bar.lateDays })}` : ''
  return `${row.subject.title} · ${dayLabel(row.bar.end)}${late}`
}

function barAria(row: SubjectRow): string {
  const base = t('roadmap.barLabel', {
    title: row.subject.title,
    owner: ownerOf(row.subject),
    state: t(`epicState.${row.subject.state}`),
    start: dayLabel(row.bar.start, true),
    end: dayLabel(row.bar.end, true),
  })
  return row.bar.lateDays > 0 ? `${base}, ${t('roadmap.barLate', { days: row.bar.lateDays })}` : base
}

function barTone(subject: RoadmapSubject): string {
  if (subject.state === 'done') {
    return 'bg-green'
  }
  return subject.state === 'blocked' ? 'bg-red' : 'bg-acc'
}

function outsideStyle(placement: Extract<LabelPlacement, { inside: false }>): Record<string, string> {
  return placement.flip ? { right: `${placement.at}%` } : { left: `${placement.at}%` }
}

function openNew(projectId: number | null = null, epicId: number | null = null): void {
  dialog.value = { event: null, projectId, epicId }
}

function openEvent(event: ProjectEvent): void {
  dialog.value = { event, projectId: event.projectId, epicId: event.epicId }
}

async function saved(): Promise<void> {
  dialog.value = null
  await Promise.all([roadmap.reload(), cards.value?.reload()])
}

onMounted(() => {
  today.value = localDay(new Date())
  return roadmap.reload()
})
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:p-8">
    <div class="flex flex-none flex-wrap items-center gap-3">
      <h2 class="title-face text-xl text-txt-hi">{{ t('roadmap.title') }}</h2>
      <button
        type="button"
        class="ml-auto rounded-lg bg-acc px-4 py-2 text-xs font-bold text-ink"
        @click="openNew()"
      >
        {{ t('roadmap.newEvent') }}
      </button>
    </div>

    <WeatherCards ref="cards" />

    <ScreenState
      :pending="roadmap.pending.value && roadmap.data.value === null"
      :failure="roadmap.failure.value"
      :empty="projects.length === 0"
      empty-key="roadmap.empty"
      @retry="roadmap.reload()"
    >
      <section
        class="flex-none"
        :aria-label="t('roadmap.upcoming')"
        data-test-id="roadmap-upcoming"
      >
        <h3 class="text-xs text-txt-low">
          {{ t('roadmap.upcoming') }}
        </h3>
        <p v-if="upcoming.length === 0" class="mt-2 text-sm text-txt-low">
          {{ t('roadmap.upcomingEmpty') }}
        </p>
        <ul v-else class="mt-2 flex gap-2 overflow-x-auto pb-1">
          <li v-for="item in upcoming" :key="item.event.id" class="flex-none">
            <button
              type="button"
              class="flex min-w-40 flex-col items-start gap-0.5 rounded-lg bg-card px-3 py-2 text-left hover:bg-elev"
              @click="openEvent(item.event)"
            >
              <span class="font-mono text-xs font-bold" :class="EVENT_TONES[item.event.type].text">
                {{ daysLeftLabel(item.daysLeft) }} · {{ dayLabel(item.event.date) }}
              </span>
              <span class="text-sm font-semibold text-txt-hi">{{ eventName(item.event) }}</span>
              <span class="text-xs text-txt-mid">
                {{ typeLabel(item.event) }} · {{ projectNameOf(item.event) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <div
        class="min-w-0 flex-none overflow-x-auto rounded-lg bg-card"
        role="region"
        tabindex="0"
        :aria-label="t('roadmap.aria')"
        data-test-id="roadmap-frame"
      >
        <div class="min-w-[760px]">
          <div class="grid grid-cols-[minmax(170px,240px)_1fr] border-b border-hair bg-panel">
            <div class="px-3 py-2 text-xs text-txt-low">
              {{ t('roadmap.subjectOwner') }}
            </div>
            <div class="relative h-9" aria-hidden="true">
              <span
                v-for="tick in ticks"
                :key="tick"
                class="absolute top-2 -translate-x-1/2 font-mono text-xs text-txt-low"
                :style="{ left: `${percentOf(tick, view)}%` }"
              >
                {{ dayLabel(tick) }}
              </span>
              <span
                class="absolute top-0 bottom-0 w-0.5 bg-txt-hi"
                :style="{ left: `${todayLeft}%` }"
                :title="t('roadmap.todayLine', { date: dayLabel(today, true) })"
              />
            </div>
          </div>

          <ul>
            <li
              v-for="block in blocks"
              :key="block.entry.project.id"
              :data-test-id="`roadmap-project-${block.entry.project.id}`"
            >
              <div class="grid grid-cols-[minmax(170px,240px)_1fr] border-b border-hair bg-elev/40">
                <div class="flex flex-col gap-1 px-3 py-2">
                  <span class="flex items-center gap-2">
                    <span
                      class="size-2.5 flex-none rounded-full"
                      :style="{ background: tintOf(block.entry.project.colour) }"
                      aria-hidden="true"
                    />
                    <strong class="title-face text-sm text-txt-hi">
                      {{ block.entry.project.name }}
                    </strong>
                  </span>
                  <span class="text-xs text-txt-mid">
                    {{
                      t(
                        'roadmap.subjectCount',
                        { count: block.entry.subjects.length },
                        block.entry.subjects.length,
                      )
                    }}
                    <template v-if="block.lateCount > 0">
                      · {{ t('roadmap.lateCount', { count: block.lateCount }) }}
                    </template>
                  </span>
                  <span
                    v-if="block.toWriteCount > 0"
                    class="w-fit text-xs font-bold text-orange"
                  >
                    {{ t('roadmap.minutesCount', { count: block.toWriteCount }, block.toWriteCount) }}
                  </span>
                  <ul
                    v-if="block.entry.links.length > 0"
                    class="flex flex-wrap gap-1"
                    :aria-label="t('roadmap.linksAria', { project: block.entry.project.name })"
                  >
                    <li v-for="link in block.entry.links" :key="`${link.kind}-${link.url}`">
                      <a
                        :href="safeHref(link.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="rounded px-1.5 py-0.5 text-xs text-info hover:bg-elev max-sm:inline-flex max-sm:min-h-10 max-sm:min-w-10 max-sm:items-center max-sm:justify-center"
                      >
                        {{ t(`linkKind.${link.kind}`) }}
                      </a>
                    </li>
                  </ul>
                </div>
                <div :ref="watchTrack" class="relative" :style="{ minHeight: `${block.height}px` }">
                  <span
                    class="absolute top-0 bottom-0 w-0.5 bg-txt-hi/60"
                    :style="{ left: `${todayLeft}%` }"
                    aria-hidden="true"
                  />
                  <template v-for="event in block.entry.events" :key="event.id">
                    <button
                      type="button"
                      class="absolute top-2 flex size-5 max-sm:top-0 max-sm:min-w-10 -translate-x-1/2 items-center justify-center rounded"
                      :style="{ left: `${percentOf(event.date, view)}%` }"
                      :aria-label="eventLabel(event)"
                      :title="eventLabel(event)"
                      @click="openEvent(event)"
                    >
                      <span
                        class="block size-3 rotate-45 border border-ink"
                        :class="EVENT_TONES[event.type].mark"
                      />
                    </button>
                    <span
                      class="pointer-events-none absolute -translate-x-1/2 text-xs font-semibold whitespace-nowrap"
                      :class="EVENT_TONES[event.type].text"
                      :style="{
                        left: `${percentOf(event.date, view)}%`,
                        top: `${BAND_LABEL_TOP_PX + (block.lanes.get(event.id) ?? 0) * LANE_HEIGHT_PX}px`,
                      }"
                      aria-hidden="true"
                    >
                      {{ typeLabel(event) }}
                    </span>
                  </template>
                </div>
              </div>

              <ul>
                <li
                  v-for="row in block.rows"
                  :key="row.subject.id"
                  class="grid grid-cols-[minmax(170px,240px)_1fr] border-b border-hair/60"
                >
                  <div class="flex flex-col px-3 py-1.5 pl-6">
                    <strong class="text-sm text-txt-hi">
                      {{ row.subject.title }}
                      <span
                        v-if="row.bar.lateDays > 0"
                        class="ml-1 text-xs font-bold text-red"
                      >
                        {{ t('roadmap.late') }}
                      </span>
                      <span
                        v-if="row.toWrite"
                        class="ml-1 rounded px-1 text-xs font-bold text-orange"
                      >
                        {{ t('roadmap.minutesToWrite') }}
                      </span>
                    </strong>
                    <small class="text-xs text-txt-mid">
                      {{ ownerOf(row.subject) }} · {{ t(`epicState.${row.subject.state}`) }}
                    </small>
                  </div>
                  <div class="relative h-11">
                    <span
                      class="absolute top-0 bottom-0 w-0.5 bg-txt-hi/60"
                      :style="{ left: `${todayLeft}%` }"
                      aria-hidden="true"
                    />
                    <span
                      role="img"
                      tabindex="0"
                      class="absolute top-2.5 flex h-6 items-center overflow-hidden rounded px-2 text-xs font-semibold whitespace-nowrap text-ink"
                      :class="barTone(row.subject)"
                      :style="{ left: `${row.extent.left}%`, width: `${row.extent.width}%` }"
                      :aria-label="barAria(row)"
                      :title="barAria(row)"
                      data-test-id="roadmap-bar"
                    >
                      <template v-if="row.placement.inside">{{ barText(row) }}</template>
                    </span>
                    <span
                      v-if="row.extent.lateWidth > 0"
                      class="roadmap-late absolute top-2.5 h-6 rounded-r"
                      :style="{
                        left: `${row.extent.left + row.extent.width}%`,
                        width: `${row.extent.lateWidth}%`,
                      }"
                      aria-hidden="true"
                    />
                    <span
                      v-if="!row.placement.inside"
                      class="pointer-events-none absolute top-3 text-xs font-semibold whitespace-nowrap text-txt-hi"
                      :style="outsideStyle(row.placement)"
                      aria-hidden="true"
                    >
                      {{ barText(row) }}
                    </span>
                    <button
                      v-for="event in row.events"
                      :key="event.id"
                      type="button"
                      class="absolute top-3 flex size-5 max-sm:top-0 max-sm:min-w-10 -translate-x-1/2 items-center justify-center rounded"
                      :style="{ left: `${percentOf(event.date, view)}%` }"
                      :aria-label="eventLabel(event)"
                      :title="eventLabel(event)"
                      @click="openEvent(event)"
                    >
                      <span
                        class="block size-3 rotate-45 border border-ink"
                        :class="EVENT_TONES[event.type].mark"
                      />
                    </button>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <section
        v-for="block in withoutDates"
        :key="`undated-${block.entry.project.id}`"
        class="flex-none rounded-lg bg-card p-4"
        :data-test-id="`roadmap-undated-${block.entry.project.id}`"
      >
        <h3 class="text-sm font-bold text-txt-hi">
          {{ block.entry.project.name }} · {{ t('roadmap.undated') }}
        </h3>
        <ul class="mt-2 flex flex-wrap gap-2">
          <li
            v-for="subject in block.undated"
            :key="subject.id"
            class="flex items-center gap-2 rounded-lg bg-elev px-3 py-1.5 text-sm text-txt-hi"
          >
            {{ subject.title }}
            <button
              type="button"
              class="text-xs font-bold text-acc"
              :aria-label="`${t('roadmap.addEvent')}, ${subject.title}`"
              @click="openNew(block.entry.project.id, subject.id)"
            >
              {{ t('roadmap.addEvent') }}
            </button>
          </li>
        </ul>
      </section>
    </ScreenState>

    <EventDialog
      v-if="dialog !== null"
      :projects="projects"
      :event="dialog.event"
      :project-id="dialog.projectId"
      :epic-id="dialog.epicId"
      :today="today"
      @close="dialog = null"
      @saved="saved"
      @changed="roadmap.reload()"
    />
  </div>
</template>
