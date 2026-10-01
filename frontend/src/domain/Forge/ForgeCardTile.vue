<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import {
  adjacentStep,
  minutesOf,
  primaryActionOf,
  type BoardStep,
  type CardAction,
} from './ForgeRule'
import { STATUS_GLYPH } from './ForgeGlyph'

const props = defineProps<{
  card: ForgeCardView
  steps: readonly BoardStep[]
  busy: boolean
}>()

const emit = defineEmits<{
  open: []
  move: [stepKey: string]
  act: [action: CardAction]
  dragging: [dragging: boolean]
}>()

const { t } = useI18n()

const previous = computed(() => adjacentStep(props.steps, props.card, -1))
const next = computed(() => adjacentStep(props.steps, props.card, 1))
const action = computed(() => primaryActionOf(props.card, props.steps))
const draggable = computed(() => !props.busy && props.card.status !== 'running' && props.card.status !== 'done')

const actionLabel = computed(() => {
  if (action.value === null) {
    return ''
  }
  if (action.value === 'validate' && next.value !== null) {
    return t('forge.action.validateTo', { step: next.value.label })
  }
  return t(`forge.action.${action.value}`)
})

const effort = computed(() =>
  props.card.durationSeconds > 0 || props.card.costUsd > 0
    ? `${t('forge.minutes', { count: minutesOf(props.card.durationSeconds) })} · ${t('forge.money', { amount: props.card.costUsd.toFixed(2) })}`
    : '',
)

function start(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', String(props.card.id))
  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
  }
  emit('dragging', true)
}
</script>

<template>
  <li
    class="flex flex-col gap-1.5 border-b border-line px-3 py-2.5 last:border-b-0"
    :class="[draggable ? 'cursor-grab' : '', busy ? 'opacity-60' : '']"
    :draggable="draggable"
    :aria-busy="busy"
    data-test="forge-card"
    data-tour="forge-card"
    @dragstart="start"
    @dragend="emit('dragging', false)"
  >
    <button
      type="button"
      class="m-0 cursor-pointer border-0 bg-transparent p-0 text-left text-sm text-txt-hi hover:underline"
      :aria-label="t('forge.cardOpen', { title: card.title })"
      @click="emit('open')"
    >
      {{ card.title }}
    </button>
    <p class="m-0 flex flex-wrap items-center gap-x-2 text-[11px] text-txt-low">
      <span class="font-mono">{{ card.storyReference }}</span>
      <span class="min-w-0 truncate">{{ card.subjectTitle }}</span>
    </p>
    <p
      v-if="card.status !== 'idle'"
      class="m-0 flex flex-wrap items-center gap-x-1.5 text-[11px]"
      :class="{
        'text-acc': card.status === 'running',
        'text-red': card.status === 'failed' || card.status === 'budget_exhausted',
        'text-orange': card.status === 'to_validate' || card.status === 'human_review' || card.status === 'stopped',
        'text-green': card.status === 'done',
      }"
    >
      <span aria-hidden="true">{{ STATUS_GLYPH[card.status] }}</span>
      <span>{{ t(`forge.status.${card.status}`) }}</span>
      <span v-if="effort !== ''" class="font-mono text-txt-low">{{ effort }}</span>
    </p>
    <p
      v-if="card.auto && card.auto.state !== 'running'"
      class="m-0 text-[11px]"
      :class="card.auto.state === 'red' ? 'text-red' : 'text-orange'"
      data-test="auto-note"
    >
      {{ t(card.auto.state === 'red' ? 'autopilot.red' : 'autopilot.paused', { reason: card.auto.reason ?? '' }) }}
    </p>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="h-7 w-7 rounded-md border border-line bg-transparent text-txt-mid hover:bg-elev disabled:opacity-30 max-sm:h-10 max-sm:w-10"
        :disabled="previous === null || busy"
        :aria-label="previous === null ? t('forge.previous') : t('forge.moveTo', { title: card.title, step: previous.label })"
        @click="previous !== null && emit('move', previous.key)"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        class="h-7 w-7 rounded-md border border-line bg-transparent text-txt-mid hover:bg-elev disabled:opacity-30 max-sm:h-10 max-sm:w-10"
        :disabled="next === null || busy"
        :aria-label="next === null ? t('forge.next') : t('forge.moveTo', { title: card.title, step: next.label })"
        @click="next !== null && emit('move', next.key)"
      >
        <span aria-hidden="true">›</span>
      </button>
      <span class="flex-1" />
      <button
        v-if="action !== null"
        type="button"
        class="rounded-md border border-line bg-transparent px-2.5 py-1 font-mono text-[11px] text-txt-hi hover:bg-elev disabled:opacity-40"
        :disabled="busy"
        @click="emit('act', action)"
      >
        {{ actionLabel }}
      </button>
    </div>
  </li>
</template>
