<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MANUAL_EPIC_STATES, type ManualEpicState } from '@contract/EpicContract'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import { tintOf } from '@/technical/Ui/Tint'
import { DUE_TONES, STATE_TONES, dayLabel } from './SubjectFormat'
import { blockedDays, dueBadge } from './SubjectRule'

const props = defineProps<{
  subject: EpicOverview
  project: Project | null
  ownerName: string | null
  showOwner: boolean
  today: string
  self: string | null
  deleted: boolean
}>()

const emit = defineEmits<{
  open: [id: number]
  take: [subject: EpicOverview]
  release: [subject: EpicOverview]
  restore: [subject: EpicOverview]
  state: [subject: EpicOverview, state: ManualEpicState]
}>()

const { t, locale } = useI18n()

const editableState = computed(() => !props.deleted && props.subject.storyCount === 0)
const canTake = computed(
  () => !props.deleted && props.subject.assignee === null && props.subject.state !== 'done',
)
const canRelease = computed(
  () =>
    !props.deleted &&
    props.self !== null &&
    props.subject.assignee === props.self &&
    props.subject.state !== 'done',
)
const badge = computed(() => dueBadge(props.subject.dueOn, props.subject.state, props.today))
const blocked = computed(() => blockedDays(props.subject.blockedSince, props.today))
const stateName = computed(() => t(`epicState.${props.subject.state}`))
const waiting = computed(() => props.subject.waitingOn[0] ?? null)
const showProgress = computed(
  () => props.subject.state !== 'todo' && props.subject.progress.total > 0,
)
const progressPercent = computed(() =>
  props.subject.progress.total === 0
    ? 0
    : Math.round((props.subject.progress.delivered / props.subject.progress.total) * 100),
)

const badgeText = computed(() => {
  switch (badge.value.kind) {
    case 'none':
      return t('common.nothing')
    case 'date':
      return props.subject.dueOn === null ? t('common.nothing') : dayLabel(props.subject.dueOn, locale.value)
    case 'late':
      return t('subjects.due.late', { days: badge.value.days })
    case 'today':
      return t('subjects.due.today')
    default:
      return t('subjects.due.in', { days: badge.value.days })
  }
})

const badgeTitle = computed(() => {
  switch (badge.value.kind) {
    case 'none':
      return t('subjects.due.none')
    case 'late':
      return t('subjects.due.lateTitle', { days: badge.value.days })
    default:
      return props.subject.dueOn === null ? '' : dayLabel(props.subject.dueOn, locale.value)
  }
})

function openFromClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('button, select, a, input, textarea') === null) {
    emit('open', props.subject.id)
  }
}

function changeState(event: Event): void {
  emit('state', props.subject, (event.target as HTMLSelectElement).value as ManualEpicState)
}
</script>

<template>
  <li
    class="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hair/60 px-4 py-3 hover:bg-elev/60 min-[760px]:grid min-[760px]:grid-cols-[1fr_auto_auto_auto] min-[760px]:items-start min-[760px]:gap-x-4"
    :data-test-id="`subject-row-${subject.id}`"
    @click="openFromClick"
  >
    <div class="flex w-full min-w-0 flex-col gap-1 min-[760px]:w-auto">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          class="rounded-md py-1.5 text-left text-sm font-semibold text-txt-hi hover:underline min-[760px]:py-0"
          :aria-label="t('subjects.row.open', { title: subject.title })"
          data-test-id="subject-open"
          @click="emit('open', subject.id)"
        >
          {{ subject.title }}
        </button>
        <span
          v-if="project !== null"
          class="inline-flex items-center gap-1 text-xs text-txt-mid"
        >
          <span
            class="size-1.5 flex-none rounded-full"
            :style="{ background: tintOf(project.colour) }"
            aria-hidden="true"
          />
          {{ project.name }}
        </span>
        <span
          v-if="subject.priority !== 'normal'"
          class="text-xs font-semibold"
          :class="subject.priority === 'max' ? 'text-red' : 'text-orange'"
        >
          {{ t(`epicPriority.${subject.priority}`) }}
        </span>
        <span
          v-for="tag in subject.tags"
          :key="tag.id"
          class="inline-flex items-center gap-1 text-xs text-txt-low"
        >
          <span
            class="size-1.5 flex-none rounded-full"
            :style="{ background: tintOf(tag.colour) }"
            aria-hidden="true"
          />
          {{ tag.label }}
        </span>
      </div>
      <p v-if="subject.statusNote !== null" class="text-sm text-txt-mid">
        {{ subject.statusNote }}
      </p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-txt-low">
        <span v-if="blocked !== null" class="font-semibold text-warn" data-test-id="subject-blocked">
          {{ t('subjects.row.blockedFor', { days: blocked }) }}
        </span>
        <span v-if="waiting !== null" data-test-id="subject-waiting">
          {{
            subject.waitingOn.length > 1
              ? t('subjects.row.waitingMore', { title: waiting.title, count: subject.waitingOn.length - 1 })
              : t('subjects.row.waitingOn', { title: waiting.title })
          }}
        </span>
        <span v-if="subject.nextEvent !== null" data-test-id="subject-event">
          {{
            t('subjects.row.nextEvent', {
              type: t(`milestone.${subject.nextEvent.type}`),
              date: dayLabel(subject.nextEvent.date, locale),
            })
          }}
        </span>
        <span v-if="subject.links.length > 0">
          {{ t('subjects.row.links', { count: subject.links.length }, subject.links.length) }}
        </span>
        <span v-if="showOwner">{{ ownerName ?? t('subjects.row.nobody') }}</span>
        <span v-if="subject.requestedBy !== null">
          {{ t('subjects.row.forWhom', { name: subject.requestedBy }) }}
        </span>
        <span v-if="showProgress" class="inline-flex items-center gap-1.5">
          <span class="h-1 w-12 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span class="block h-full bg-txt-mid" :style="{ width: `${progressPercent}%` }" />
          </span>
          {{
            t('subjects.row.stories', {
              delivered: subject.progress.delivered,
              total: subject.progress.total,
            })
          }}
        </span>
        <span v-if="deleted && subject.deletedAt !== null">
          {{ t('subjects.row.deletedOn', { date: dayLabel(subject.deletedAt.slice(0, 10), locale) }) }}
        </span>
      </div>
    </div>

    <select
      v-if="editableState"
      class="justify-self-start rounded-md bg-elev px-2 py-1 text-xs font-semibold"
      :class="STATE_TONES[subject.state]"
      :value="subject.state"
      :aria-label="`${t(`epicState.${subject.state}`)}, ${t('subjects.row.stateOf', { title: subject.title })}`"
      data-test-id="subject-state"
      @change="changeState"
    >
      <option v-for="state in MANUAL_EPIC_STATES" :key="state" :value="state">
        {{ t(`epicState.${state}`) }}
      </option>
    </select>
    <span
      v-else
      class="w-fit justify-self-start px-2 py-1 text-xs font-semibold"
      :class="STATE_TONES[subject.state]"
      :title="deleted ? undefined : t('subjects.row.derived')"
      data-test-id="subject-state-label"
    >
      {{ stateName }}
    </span>

    <span
      class="w-fit justify-self-start px-1 py-1 font-mono text-xs font-semibold"
      :class="DUE_TONES[badge.kind]"
      :title="badgeTitle"
      data-test-id="subject-due"
    >
      <span aria-hidden="true">{{ badgeText }}</span>
      <span class="sr-only">{{ badgeTitle === '' ? badgeText : badgeTitle }}</span>
    </span>

    <button
      v-if="deleted"
      type="button"
      class="justify-self-start rounded-md px-2.5 py-1 max-[759px]:min-h-10 text-xs font-semibold text-txt-hi hover:bg-elev"
      :aria-label="t('subjects.row.restoreAria', { title: subject.title })"
      data-test-id="subject-restore"
      @click="emit('restore', subject)"
    >
      {{ t('subjects.row.restore') }}
    </button>
    <button
      v-else-if="canTake"
      type="button"
      class="justify-self-start rounded-md px-2.5 py-1 max-[759px]:min-h-10 text-xs font-semibold text-txt-hi hover:bg-elev"
      :aria-label="`${t('subjects.row.take')}, ${subject.title}`"
      data-test-id="subject-take"
      @click="emit('take', subject)"
    >
      {{ t('subjects.row.take') }}
    </button>
    <button
      v-else-if="canRelease"
      type="button"
      class="justify-self-start rounded-md px-2.5 py-1 max-[759px]:min-h-10 text-xs font-semibold text-txt-low hover:bg-elev hover:text-txt-hi"
      :aria-label="t('subjects.row.releaseAria', { title: subject.title })"
      data-test-id="subject-release"
      @click="emit('release', subject)"
    >
      {{ t('subjects.row.release') }}
    </button>
    <span v-else />
  </li>
</template>
