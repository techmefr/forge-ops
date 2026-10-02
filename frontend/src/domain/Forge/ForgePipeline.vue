<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import { DOT_GLYPH } from './ForgeGlyph'
import {
  adjacentStep,
  dotsOf,
  minutesOf,
  pipelineOrder,
  primaryActionOf,
  type BoardStep,
  type CardAction,
} from './ForgeRule'

const props = defineProps<{
  steps: readonly BoardStep[]
  cards: readonly ForgeCardView[]
  busy: ReadonlySet<number>
  projectName: string
}>()

const emit = defineEmits<{
  open: [card: ForgeCardView]
  act: [card: ForgeCardView, action: CardAction]
}>()

const { t } = useI18n()

const rows = computed(() => pipelineOrder(props.cards))

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
  const next = adjacentStep(props.steps, card, 1)
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
</script>

<template>
  <div class="h-full min-w-0 overflow-auto rounded-lg border border-line bg-panel" data-test="forge-pipeline">
    <table class="w-full min-w-[640px] border-collapse text-left" :aria-label="t('forge.pipeline.aria')">
      <thead class="sticky top-0 z-10 bg-panel">
        <tr class="border-b border-line text-xs text-txt-low">
          <th scope="col" class="px-3 py-2 font-normal">{{ t('forge.pipeline.story') }}</th>
          <th scope="col" class="px-3 py-2 font-normal">{{ t('forge.pipeline.steps', { name: projectName }) }}</th>
          <th scope="col" class="px-3 py-2 font-normal">{{ t('forge.pipeline.status') }}</th>
          <th scope="col" class="px-3 py-2 text-right font-normal">
            <span class="sr-only">{{ t('forge.pipeline.duration') }} / {{ t('forge.pipeline.cost') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td colspan="4" class="px-3 py-4 text-xs text-txt-low">{{ t('forge.pipeline.empty') }}</td>
        </tr>
        <tr
          v-for="card in rows"
          :key="card.id"
          class="border-b border-line last:border-b-0"
          :aria-busy="busy.has(card.id)"
          data-test="forge-row"
        >
          <td class="max-w-[16rem] px-3 py-2 align-top">
            <button
              type="button"
              class="m-0 block max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-sm text-txt-hi hover:underline"
              :aria-label="t('forge.cardOpen', { title: card.title })"
              @click="emit('open', card)"
            >
              {{ card.title }}
            </button>
            <span class="block truncate text-xs text-txt-low">{{ card.subjectTitle }}</span>
          </td>
          <td class="px-3 py-2 align-top">
            <ol class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
              <li
                v-for="dot in dotsOf(card, steps)"
                :key="dot.key"
                class="flex items-center gap-1 text-xs"
                :class="{ 'text-acc': dot.state === 'running', 'text-red': dot.state === 'failed' || dot.state === 'budget_exhausted', 'text-orange': dot.state === 'to_validate' || dot.state === 'human_review' || dot.state === 'stopped', 'text-green': dot.state === 'passed', 'text-txt-low': dot.state === 'to_come' || dot.state === 'waiting', }"
                :title="`${dot.label} · ${t(`forge.dot.${dot.state}`)}`"
                data-test="forge-dot"
                :data-state="dot.state"
              >
                <span
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs leading-none"
                  aria-hidden="true"
                  >{{ DOT_GLYPH[dot.state] }}</span
                >
                <span>{{ dot.label }}</span>
                <span class="sr-only">{{ t(`forge.dot.${dot.state}`) }}</span>
              </li>
            </ol>
          </td>
          <td class="px-3 py-2 align-top text-xs">
            <span
              :class="{ 'text-acc': card.status === 'running', 'text-red': card.status === 'failed' || card.status === 'budget_exhausted', 'text-orange': card.status === 'to_validate' || card.status === 'human_review' || card.status === 'stopped', 'text-green': card.status === 'done', 'text-txt-mid': card.status === 'idle', }"
              >{{ labelOf(card) }}</span
            >
            <span v-if="effort(card) !== ''" class="block font-mono text-txt-low">{{ effort(card) }}</span>
            <span
              v-if="card.auto && card.auto.state !== 'running'"
              class="block"
              :class="card.auto.state === 'red' ? 'text-red' : 'text-orange'"
              data-test="auto-note"
              >{{ t(card.auto.state === 'red' ? 'autopilot.red' : 'autopilot.paused', { reason: card.auto.reason ?? '' }) }}</span
            >
          </td>
          <td class="px-3 py-2 text-right align-top">
            <button
              v-if="primaryActionOf(card, steps) !== null"
              type="button"
              class="rounded-md border border-line bg-transparent px-2.5 py-1 text-xs whitespace-nowrap text-txt-hi hover:bg-elev disabled:opacity-40"
              :disabled="busy.has(card.id)"
              @click="emit('act', card, primaryActionOf(card, steps)!)"
            >
              {{ actionLabel(card, primaryActionOf(card, steps)!) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
