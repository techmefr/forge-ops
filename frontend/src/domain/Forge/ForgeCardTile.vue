<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import {
  adjacentStep,
  primaryActionOf,
  type BoardStep,
  type CardAction,
} from './ForgeRule'

const props = defineProps<{
  card: ForgeCardView
  steps: readonly BoardStep[]
  busy: boolean
}>()

const emit = defineEmits<{
  open: []
  act: [action: CardAction]
  dragging: [dragging: boolean]
}>()

const { t } = useI18n()

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

const statusLabel = computed(() => {
  if (props.card.auto && props.card.auto.state !== 'running') {
    return t(props.card.auto.state === 'red' ? 'forge.attention' : 'forge.paused')
  }
  return props.card.status === 'idle' ? '' : t(`forge.status.${props.card.status}`)
})

const statusTone = computed(() => {
  if (props.card.auto && props.card.auto.state !== 'running') {
    return props.card.auto.state === 'red' ? 'chip-bad' : 'chip-wait'
  }
  const status = props.card.status
  if (status === 'running') {
    return 'chip-run'
  }
  if (status === 'failed' || status === 'budget_exhausted') {
    return 'chip-bad'
  }
  if (status === 'to_validate' || status === 'human_review' || status === 'stopped') {
    return 'chip-wait'
  }
  return status === 'done' ? 'chip-ok' : 'chip-idle'
})

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
    class="card card-hover flex flex-col gap-2 p-4"
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
      class="m-0 cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-medium text-txt-hi hover:underline"
      :aria-label="t('forge.cardOpen', { title: card.title })"
      @click="emit('open')"
    >
      {{ card.title }}
    </button>
    <div class="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span class="font-mono text-txt-low">{{ card.storyReference }}</span>
      <span v-if="statusLabel !== ''" class="chip min-w-0" :class="statusTone" data-test="card-status">
        <span class="size-1.5 flex-none rounded-full bg-current" aria-hidden="true" />
        <span class="truncate">{{ statusLabel }}</span>
      </span>
      <span class="flex-1" />
      <button
        v-if="action !== null"
        type="button"
        class="btn btn-ghost btn-sm text-acc"
        :disabled="busy"
        @click="emit('act', action)"
      >
        {{ actionLabel }}
      </button>
    </div>
  </li>
</template>
