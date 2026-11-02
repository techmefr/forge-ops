<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import { minutesToWrite, type ProjectEvent } from '@contract/EventContract'
import WeatherCards from '@/domain/FollowUp/WeatherCards.vue'
import EventDialog from './EventDialog.vue'
import RoadmapProjectHeader from './RoadmapProjectHeader.vue'
import RoadmapSubjectRow from './RoadmapSubjectRow.vue'
import RoadmapUndated from './RoadmapUndated.vue'
import RoadmapUpcoming from './RoadmapUpcoming.vue'
import type { ProjectBlock, SubjectRow } from './RoadmapBlock'
import { useRoadmapLabels } from './UseRoadmapLabels'
import { EVENT_TONES } from './EventTone'
import {
  barOf,
  extentOf,
  labelPlacement,
  lanesOf,
  localDay,
  percentOf,
  subjectsWithoutDates,
  ticksOf,
  upcomingOf,
  windowOf,
} from './Timeline'
import { useRoadmap, type RoadmapProject } from './UseRoadmap'

const DEFAULT_TRACK_PX = 900
const MARKER_HIT_PX = 24
const MARKER_HIT_PHONE_PX = 40
const PHONE_MAX_PX = 640
const MARKER_INSET_PX = 4
const LABELLED_EVENTS = 3
const FLIP_LABEL_FROM_PERCENT = 80

const trackPx = ref(DEFAULT_TRACK_PX)
const hitPx = ref(MARKER_HIT_PX)
let trackObserver: ResizeObserver | undefined

function watchTrack(element: unknown): void {
  if (!(element instanceof HTMLElement) || trackObserver !== undefined) {
    return
  }
  const measure = (): void => {
    trackPx.value = element.clientWidth || DEFAULT_TRACK_PX
    hitPx.value = window.innerWidth < PHONE_MAX_PX ? MARKER_HIT_PHONE_PX : MARKER_HIT_PX
  }
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    trackObserver = new ResizeObserver(measure)
    trackObserver.observe(element)
  }
}

onBeforeUnmount(() => trackObserver?.disconnect())
const UPCOMING_LIMIT = 8


const { t } = useI18n()

const roadmap = useRoadmap()
const cards = ref<InstanceType<typeof WeatherCards> | null>(null)
const today = ref(localDay(new Date()))
const { dayLabel, typeLabel, eventLabel } = useRoadmapLabels(today)
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
          toWrite: events.some((event) => minutesToWrite(event, today.value)),
        },
      ]
    })
    .sort((one, other) => one.bar.start.localeCompare(other.bar.start))
}

const blocks = computed<readonly ProjectBlock[]>(() =>
  projects.value.map((entry) => {
    const rows = rowsOf(entry)
    const hitPercent = (hitPx.value / Math.max(trackPx.value, 1)) * 100
    const widths = new Map(entry.events.map((event) => [event.id, hitPercent] as const))
    const lanes = lanesOf(entry.events, view.value, widths)
    return {
      entry,
      rows,
      undated: subjectsWithoutDates(entry.subjects, entry.events, today.value),
      lateCount: rows.filter((row) => row.bar.lateDays > 0).length,
      toWriteCount: entry.events.filter((event) => minutesToWrite(event, today.value)).length,
      lanes,
      labelled: new Set(upcomingOf(entry.events, today.value, LABELLED_EVENTS).map((item) => item.event.id)),
      height: MARKER_INSET_PX * 2 + (Math.max(0, ...lanes.values()) + 1) * hitPx.value,
    }
  }),
)

const withoutDates = computed(() => blocks.value.filter((block) => block.undated.length > 0))

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
    <WeatherCards ref="cards" />

    <ScreenState
      :pending="roadmap.pending.value && roadmap.data.value === null"
      :failure="roadmap.failure.value"
      :empty="projects.length === 0"
      empty-key="roadmap.empty"
      @retry="roadmap.reload()"
    >
      <RoadmapUpcoming
        :items="upcoming"
        :projects="projects"
        :today="today"
        @open="openEvent"
        @create="openNew()"
      />

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
                class="absolute top-2 -translate-x-1/2 tabular-nums text-xs text-txt-low"
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
                <RoadmapProjectHeader :block="block" />
                <div :ref="watchTrack" class="relative" :style="{ minHeight: `${block.height}px` }">
                  <span
                    class="absolute top-0 bottom-0 w-0.5 bg-txt-hi/60"
                    :style="{ left: `${todayLeft}%` }"
                    aria-hidden="true"
                  />
                  <button
                    v-for="event in block.entry.events"
                    :key="event.id"
                    type="button"
                    class="group absolute flex size-6 -translate-x-1/2 items-center justify-center rounded hover:z-10 focus-visible:z-10 max-sm:size-10"
                    :style="{
                      left: `${percentOf(event.date, view)}%`,
                      top: `${MARKER_INSET_PX + (block.lanes.get(event.id) ?? 0) * hitPx}px`,
                    }"
                    :aria-label="eventLabel(event)"
                    :title="eventLabel(event)"
                    @click="openEvent(event)"
                  >
                    <span
                      class="block size-2 rotate-45 border border-ink"
                      :class="EVENT_TONES[event.type].mark"
                    />
                    <span
                      class="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded bg-card px-1 text-xs font-medium whitespace-nowrap"
                      :class="[
                        EVENT_TONES[event.type].text,
                        percentOf(event.date, view) > FLIP_LABEL_FROM_PERCENT ? 'right-full' : 'left-full',
                        block.labelled.has(event.id)
                          ? ''
                          : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                      ]"
                      aria-hidden="true"
                    >
                      {{ typeLabel(event) }}
                    </span>
                  </button>
                </div>
              </div>

              <ul>
                <RoadmapSubjectRow
                  v-for="row in block.rows"
                  :key="row.subject.id"
                  :row="row"
                  :today-left="todayLeft"
                  :today="today"
                />
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <RoadmapUndated
        v-for="block in withoutDates"
        :key="`undated-${block.entry.project.id}`"
        :block="block"
        @add="openNew"
      />
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
