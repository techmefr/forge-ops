<script setup lang="ts">
import Avatar from '@/technical/Ui/Avatar.vue'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { VIEW_LATE, stepSelection } from './SubjectRule'
import type { PersonRow, ViewRow } from './SubjectSidebarRow'

const props = defineProps<{
  selection: string
  views: readonly ViewRow[]
  rows: readonly PersonRow[]
  order: readonly string[]
  self: string | null
}>()

const emit = defineEmits<{ select: [view: string] }>()

const { t } = useI18n()

const peopleRoot = ref<HTMLElement | null>(null)

const TONE_CLASSES = {
  neutral: 'text-txt-low',
  full: 'text-orange',
  over: 'text-red',
} as const

const SELECTED_CLASSES = 'bg-acc/10 text-txt-hi shadow-[inset_3px_0_0_0_var(--color-acc)]'

const IDLE_CLASSES = 'text-txt-mid hover:bg-elev/60'

function focusSelected(): void {
  const buttons = peopleRoot.value?.querySelectorAll<HTMLElement>('[data-selection]') ?? []
  Array.from(buttons)
    .find((button) => button.dataset.selection === props.selection)
    ?.focus()
}

async function moveWithArrows(event: KeyboardEvent): Promise<void> {
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
  if (!forward && !backward) {
    return
  }
  event.preventDefault()
  emit('select', stepSelection([...props.order], props.selection, forward ? 1 : -1))
  await nextTick()
  focusSelected()
}

function loadDescription(row: PersonRow): string {
  const base =
    row.person.capacity === null
      ? t('subjects.loadAlone', { load: row.load }, row.load)
      : t('subjects.loadOf', { load: row.load, capacity: row.person.capacity }, row.load)
  if (row.tone === 'full') {
    return `${base}, ${t('subjects.atCapacity')}`
  }
  return row.tone === 'over' ? `${base}, ${t('subjects.overCapacity')}` : base
}
</script>

<template>
  <div
    ref="peopleRoot"
    class="relative flex min-w-0 flex-row gap-0.5 overflow-x-auto border-b border-hair pb-2 min-[760px]:flex-col min-[760px]:overflow-x-visible min-[760px]:border-r min-[760px]:border-b-0 min-[760px]:pr-4 min-[760px]:pb-0"
    role="group"
    :aria-label="t('subjects.teamAria')"
    data-test-id="subjects-people"
    @keydown="moveWithArrows"
  >
    <h2 class="hidden px-2.5 pb-1 text-xs text-txt-low min-[760px]:block">
      {{ t('subjects.views') }}
    </h2>
    <button
      v-for="view in views"
      :key="view.key"
      type="button"
      class="flex min-h-12 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm min-[760px]:w-full"
      :class="selection === view.key ? SELECTED_CLASSES : IDLE_CLASSES"
      :tabindex="selection === view.key ? 0 : -1"
      :aria-current="selection === view.key ? 'true' : undefined"
      :data-selection="view.key"
      :data-test-id="view.testId"
      @click="emit('select', view.key)"
    >
      <span class="flex-1 whitespace-nowrap">{{ view.label }}</span>
      <span class="tabular-nums text-xs" :class="view.key === VIEW_LATE && view.count > 0 ? 'text-red' : 'text-txt-low'" :data-test-id="view.countId">{{ view.count }}</span>
    </button>

    <h2 class="hidden px-2.5 pt-4 pb-1 text-xs text-txt-low min-[760px]:block">
      {{ t('subjects.team') }}
    </h2>
    <button
      v-for="row in rows"
      :key="row.person.login"
      type="button"
      class="flex min-h-12 flex-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm min-[760px]:w-full"
      :class="selection === row.person.login ? SELECTED_CLASSES : IDLE_CLASSES"
      :tabindex="selection === row.person.login ? 0 : -1"
      :aria-current="selection === row.person.login ? 'true' : undefined"
      :data-selection="row.person.login"
      :data-test-id="`person-${row.person.login}`"
      @click="emit('select', row.person.login)"
    >
      <Avatar :name="row.person.displayName" :size="28" />
      <span class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span class="truncate whitespace-nowrap">
          {{ row.person.displayName }}<span v-if="row.person.login === self" class="ml-1 text-txt-low">{{ t('subjects.me') }}</span><span v-if="!row.person.active" class="ml-1 text-txt-low" data-test-id="person-inactive">{{ t('team.inactive') }}</span>
        </span>
        <span
          v-if="row.flags.late > 0 || row.flags.blocked > 0"
          class="flex flex-wrap gap-x-2 text-xs"
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
        class="flex-none tabular-nums text-xs"
        :class="TONE_CLASSES[row.tone]"
        :title="loadDescription(row)"
        :data-tone="row.tone"
        data-test-id="load-chip"
      >
        <span aria-hidden="true">{{ row.text }}</span>
        <span class="sr-only">{{ loadDescription(row) }}</span>
      </span>
    </button>
  </div>
</template>
