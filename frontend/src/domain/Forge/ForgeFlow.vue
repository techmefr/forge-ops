<script setup lang="ts">
import { onMounted, onUpdated, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import Glyph from '@/technical/Ui/Glyph.vue'
import { DOT_ICON } from './ForgeGlyph'
import {
  adjacentStep,
  canOpenDot,
  dotsOf,
  minutesOf,
  primaryActionOf,
  type BoardStep,
  type CardAction,
  type WorkflowLane,
} from './ForgeRule'

const props = defineProps<{
  lanes: readonly WorkflowLane[]
  stepsByWorkflow: ReadonlyMap<number, readonly BoardStep[]>
  busy: ReadonlySet<number>
}>()

const emit = defineEmits<{
  open: [card: ForgeCardView, stepKey: string]
  act: [card: ForgeCardView, action: CardAction]
}>()

const { t } = useI18n()

const root = ref<HTMLElement | null>(null)

function stepsOf(card: ForgeCardView): readonly BoardStep[] {
  return props.stepsByWorkflow.get(card.workflowId) ?? []
}

function labelOf(card: ForgeCardView): string {
  if (card.stepKey === 'backlog') {
    return t('forge.backlog')
  }
  if (card.stepKey === 'done') {
    return t('forge.done')
  }
  return t(`forge.status.${card.status}`)
}

function actionLabel(card: ForgeCardView, action: CardAction): string {
  const next = adjacentStep(stepsOf(card), card, 1)
  return action === 'validate' && next !== null
    ? t('forge.action.validateTo', { step: next.label })
    : t(`forge.action.${action}`)
}

function effort(card: ForgeCardView): string {
  if (card.durationSeconds === 0 && card.costUsd === 0) {
    return ''
  }
  return `${t('forge.minutes', { count: minutesOf(card.durationSeconds) })} · ${t('forge.money', { amount: card.costUsd.toFixed(2) })}`
}

function isCurrent(card: ForgeCardView, stepKey: string): boolean {
  return card.stepKey === stepKey
}

function centreCurrentSteps(): void {
  for (const current of root.value?.querySelectorAll<HTMLElement>('[aria-current="step"]') ?? []) {
    const strip = current.closest('ol')
    if (strip !== null) {
      strip.scrollLeft = current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2
    }
  }
}

onMounted(centreCurrentSteps)
onUpdated(centreCurrentSteps)
</script>

<template>
  <div ref="root" class="flex min-w-0 flex-col gap-5" data-test="forge-flow">
    <p v-if="lanes.length === 0" class="m-0 py-2 text-xs text-txt-low">{{ t('forge.pipeline.empty') }}</p>
    <section
      v-for="lane in lanes"
      :key="lane.workflow.id"
      class="min-w-0"
      :aria-label="lane.workflow.name"
      data-test="forge-lane"
    >
      <h3 class="m-0 mb-2 flex items-baseline gap-2 text-sm text-txt-hi" data-test="forge-lane-title">
        {{ lane.workflow.name }}
        <span class="text-xs tabular-nums text-txt-low">{{ lane.cards.length }}</span>
      </h3>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li
          v-for="card in lane.cards"
          :key="card.id"
          class="min-w-0 rounded-lg bg-panel px-3 py-2"
          :aria-busy="busy.has(card.id)"
          data-test="forge-row"
        >
          <div class="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-1">
            <div class="min-w-0 flex-1 basis-48">
              <button
                type="button"
                class="m-0 block max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-sm text-txt-hi hover:underline"
                :aria-label="t('forge.cardOpen', { title: card.title })"
                @click="emit('open', card, card.stepKey)"
              >
                {{ card.title }}
              </button>
              <span class="block truncate text-xs text-txt-low">{{ card.subjectTitle }}</span>
            </div>
            <div class="text-xs">
              <span
                :class="{
                  'text-acc': card.status === 'running',
                  'text-red': card.status === 'failed' || card.status === 'budget_exhausted',
                  'text-orange': card.status === 'to_validate' || card.status === 'human_review' || card.status === 'stopped',
                  'text-green': card.status === 'done',
                  'text-txt-mid': card.status === 'idle',
                }"
                >{{ labelOf(card) }}</span
              >
              <span v-if="effort(card) !== ''" class="block tabular-nums text-txt-low">{{ effort(card) }}</span>
              <span
                v-if="card.auto && card.auto.state !== 'running'"
                class="block"
                :class="card.auto.state === 'red' ? 'text-red' : 'text-orange'"
                data-test="auto-note"
                >{{ t(card.auto.state === 'red' ? 'autopilot.red' : 'autopilot.paused', { reason: card.auto.reason ?? '' }) }}</span
              >
            </div>
            <button
              v-if="primaryActionOf(card, stepsOf(card)) !== null"
              type="button"
              class="btn btn-ghost btn-sm whitespace-nowrap"
              :disabled="busy.has(card.id)"
              @click="emit('act', card, primaryActionOf(card, stepsOf(card))!)"
            >
              {{ actionLabel(card, primaryActionOf(card, stepsOf(card))!) }}
            </button>
          </div>
          <ol class="m-0 mt-2 flex list-none items-center overflow-x-auto p-0 pb-1" :aria-label="t('forge.flow.stepsAria', { title: card.title })">
            <li
              v-for="(dot, index) in dotsOf(card, stepsOf(card))"
              :key="dot.key"
              class="flex flex-none items-center"
              data-test="forge-dot"
              :data-state="dot.state"
            >
              <span v-if="index > 0" class="h-px w-4 flex-none bg-hair min-[560px]:w-8" aria-hidden="true" />
              <button
                type="button"
                class="flex items-center gap-1 rounded-md border-0 px-2 py-1 text-xs"
                :class="[
                  isCurrent(card, dot.key) ? 'bg-elev' : 'bg-transparent',
                  canOpenDot(dot) ? 'cursor-pointer hover:bg-elev' : 'cursor-default',
                  {
                    'text-acc': dot.state === 'running',
                    'text-red': dot.state === 'failed' || dot.state === 'budget_exhausted',
                    'text-orange': dot.state === 'to_validate' || dot.state === 'human_review' || dot.state === 'stopped',
                    'text-green': dot.state === 'passed',
                    'text-txt-low': dot.state === 'to_come' || dot.state === 'waiting',
                  },
                ]"
                :disabled="!canOpenDot(dot)"
                :aria-current="isCurrent(card, dot.key) ? 'step' : undefined"
                :title="`${dot.label} · ${t(`forge.dot.${dot.state}`)}`"
                @click="emit('open', card, dot.key)"
              >
                <Glyph v-if="DOT_ICON[dot.state] !== ''" :name="DOT_ICON[dot.state]" :size="14" />
                <span v-else class="size-3.5" aria-hidden="true" />
                <span class="whitespace-nowrap">{{ dot.label }}</span>
                <span class="sr-only">{{ t(`forge.dot.${dot.state}`) }}</span>
              </button>
            </li>
          </ol>
        </li>
      </ul>
    </section>
  </div>
</template>
