<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import { tintOf } from '@/technical/Ui/Tint'
import ForgeCardTile from './ForgeCardTile.vue'
import { canDropInto, cardsOfStep, type BoardStep, type CardAction } from './ForgeRule'

const props = defineProps<{
  steps: readonly BoardStep[]
  cards: readonly ForgeCardView[]
  busy: ReadonlySet<number>
}>()

const emit = defineEmits<{
  open: [card: ForgeCardView]
  move: [card: ForgeCardView, stepKey: string]
  act: [card: ForgeCardView, action: CardAction]
}>()

const { t } = useI18n()

const draggedId = ref<number | null>(null)
const overKey = ref<string | null>(null)

const dragged = computed(() => props.cards.find((card) => card.id === draggedId.value) ?? null)

function accepts(step: BoardStep): boolean {
  return dragged.value !== null && canDropInto(dragged.value, step)
}

function enter(step: BoardStep, event: DragEvent): void {
  if (!accepts(step)) {
    return
  }
  event.preventDefault()
  overKey.value = step.key
  if (event.dataTransfer !== null) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function drop(step: BoardStep, event: DragEvent): void {
  event.preventDefault()
  const card = dragged.value
  overKey.value = null
  draggedId.value = null
  if (card !== null && canDropInto(card, step)) {
    emit('move', card, step.key)
  }
}

function dragging(card: ForgeCardView, on: boolean): void {
  draggedId.value = on ? card.id : null
  if (!on) {
    overKey.value = null
  }
}
</script>

<template>
  <div
    class="flex h-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden pb-1"
    role="group"
    tabindex="0"
    :aria-label="t('forge.boardAria')"
    data-test="forge-kanban"
  >
    <section
      v-for="step in steps"
      :key="step.key"
      class="flex h-full w-[min(272px,82vw)] flex-none flex-col overflow-y-auto overscroll-contain rounded-lg border border-line bg-panel"
      :class="overKey === step.key ? 'outline-2 outline-acc' : ''"
      :aria-label="t('forge.columnAria', { step: step.label, count: cardsOfStep(cards, step.key).length }, cardsOfStep(cards, step.key).length)"
      :data-step="step.key"
      @dragover="enter(step, $event)"
      @dragenter="enter(step, $event)"
      @dragleave="overKey === step.key && (overKey = null)"
      @drop="drop(step, $event)"
    >
      <header class="sticky top-0 z-10 flex flex-col gap-0.5 border-b border-hair bg-panel px-3 py-3">
        <div class="flex items-center gap-2">
          <span
            class="h-2 w-2 flex-none rounded-full"
            :style="{ background: tintOf(step.colour) }"
            aria-hidden="true"
          />
          <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-txt-hi">{{ step.label }}</h3>
          <span class="tabular-nums text-xs text-txt-low">{{ cardsOfStep(cards, step.key).length }}</span>
        </div>
      </header>
      <ul class="m-0 flex min-h-[3rem] flex-1 list-none flex-col gap-3 p-3">
        <ForgeCardTile
          v-for="card in cardsOfStep(cards, step.key)"
          :key="card.id"
          :card="card"
          :steps="steps"
          :busy="busy.has(card.id)"
          @open="emit('open', card)"
          @act="(action) => emit('act', card, action)"
          @dragging="(on) => dragging(card, on)"
        />
        <li v-if="cardsOfStep(cards, step.key).length === 0" class="rounded-md border border-dashed border-line px-3 py-4 text-center text-xs text-txt-mid">
          {{ t('forge.emptyColumn') }}
        </li>
      </ul>
    </section>
  </div>
</template>
