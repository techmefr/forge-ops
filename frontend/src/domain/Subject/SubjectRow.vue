<script setup lang="ts">
import Avatar from '@/technical/Ui/Avatar.vue'
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
  selected?: boolean
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
const blocked = computed(() => blockedDays(props.subject.blockedSince, props.today))
const badge = computed(() => dueBadge(props.subject.dueOn, props.subject.state, props.today))
const stateName = computed(() => t(`epicState.${props.subject.state}`))
const isBlocked = computed(() => props.subject.state === 'blocked' && !props.deleted)
const showProgress = computed(
  () => props.subject.state !== 'todo' && props.subject.progress.total > 0,
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
    class="group card card-hover flex min-h-12 cursor-pointer flex-col gap-3 p-4"
    :class="selected ? 'ring-2 ring-acc' : ''"
    :data-test-id="`subject-row-${subject.id}`"
    @click="openFromClick"
  >
    <div class="flex items-start gap-3">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            class="rounded-md text-left text-lg font-bold leading-snug text-txt-hi hover:underline"
            :aria-label="t('subjects.row.open', { title: subject.title })"
            data-test-id="subject-open"
            @click="emit('open', subject.id)"
          >
            {{ subject.title }}
          </button>
          <span
            v-if="subject.priority !== 'normal'"
            class="pill"
            :class="subject.priority === 'max' ? 'text-red' : 'text-orange'"
          >
            {{ t(`epicPriority.${subject.priority}`) }}
          </span>
        </div>
        <span v-if="project !== null" class="inline-flex items-center gap-1.5 text-xs text-txt-low">
          <span class="size-2 flex-none rounded-full" :style="{ background: tintOf(project.colour) }" aria-hidden="true" />
          {{ project.name }}
        </span>
      </div>
      <select
        v-if="editableState"
        class="field field-sm flex-none font-semibold"
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
        class="pill flex-none"
        :class="STATE_TONES[subject.state]"
        :title="deleted ? undefined : t('subjects.row.derived')"
        data-test-id="subject-state-label"
      >
        {{ stateName }}
      </span>
    </div>

    <p v-if="subject.businessIntent !== ''" class="line-clamp-3 text-sm text-txt-mid" data-test-id="subject-description">
      {{ subject.businessIntent }}
    </p>

    <div
      v-if="isBlocked"
      class="flex flex-col gap-1 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm"
      data-test-id="subject-blocked"
    >
      <strong class="text-warn">
        {{ blocked !== null && blocked > 0 ? t('subjects.row.blockedFor', { days: blocked }) : t('epicState.blocked') }}
      </strong>
      <span v-if="subject.statusNote !== null && subject.statusNote !== ''" class="text-txt-hi" data-test-id="subject-blocked-reason">
        {{ subject.statusNote }}
      </span>
      <span v-if="subject.waitingOn.length > 0" class="text-txt-mid" data-test-id="subject-waiting-on">
        {{ t('subjects.row.waitingOn', { titles: subject.waitingOn.map((other) => other.title).join(', ') }) }}
      </span>
    </div>
    <p
      v-else-if="subject.waitingOn.length > 0"
      class="text-xs text-txt-mid"
      data-test-id="subject-waiting-on"
    >
      {{ t('subjects.row.waitingOn', { titles: subject.waitingOn.map((other) => other.title).join(', ') }) }}
    </p>

    <div v-if="showProgress" class="flex flex-col gap-1">
      <span
        class="h-1.5 w-full overflow-hidden rounded-full bg-elev"
        role="progressbar"
        :aria-valuenow="subject.progress.delivered"
        aria-valuemin="0"
        :aria-valuemax="subject.progress.total"
      >
        <span class="block h-full rounded-full bg-info" :style="{ width: `${Math.round((subject.progress.delivered / subject.progress.total) * 100)}%` }" />
      </span>
      <span class="text-xs text-txt-mid">
        {{ t('subjects.row.stories', { delivered: subject.progress.delivered, total: subject.progress.total }) }}
      </span>
    </div>

    <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-xs text-txt-low">
      <span
        class="tabular-nums font-semibold"
        :class="DUE_TONES[badge.kind]"
        :title="badgeTitle"
        data-test-id="subject-due"
      >
        <span aria-hidden="true">{{ badgeText }}</span>
        <span class="sr-only">{{ badgeTitle === '' ? badgeText : badgeTitle }}</span>
      </span>
      <span v-if="showOwner" class="inline-flex items-center gap-1.5">
        <Avatar v-if="ownerName !== null" :name="ownerName" :size="20" />
        {{ ownerName ?? t('subjects.row.nobody') }}
      </span>
      <span v-if="deleted && subject.deletedAt !== null">
        {{ t('subjects.row.deletedOn', { date: dayLabel(subject.deletedAt.slice(0, 10), locale) }) }}
      </span>
      <span class="ml-auto flex items-center gap-1">
        <button
          v-if="deleted"
          type="button"
          class="btn btn-ghost btn-sm"
          :aria-label="t('subjects.row.restoreAria', { title: subject.title })"
          data-test-id="subject-restore"
          @click="emit('restore', subject)"
        >
          {{ t('subjects.row.restore') }}
        </button>
        <button
          v-else-if="canTake"
          type="button"
          class="btn btn-ghost btn-sm"
          :aria-label="`${t('subjects.row.take')}, ${subject.title}`"
          data-test-id="subject-take"
          @click="emit('take', subject)"
        >
          {{ t('subjects.row.take') }}
        </button>
        <button
          v-else-if="canRelease"
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-semibold text-txt-low hover:bg-elev hover:text-txt-hi focus-visible:opacity-100"
          :class="selected ? '' : '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100'"
          :aria-label="t('subjects.row.releaseAria', { title: subject.title })"
          data-test-id="subject-release"
          @click="emit('release', subject)"
        >
          {{ t('subjects.row.release') }}
        </button>
      </span>
    </div>
  </li>
</template>
