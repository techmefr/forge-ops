<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BudgetSettings, MachineReading } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { gaugesOf } from '@/domain/Resource/MachineGauge'
import { roomForSessions } from '@/domain/Resource/Estimate'
import { useFleet } from '@/domain/Shell/UseFleet'

const emit = defineEmits<{ details: [] }>()

const { t } = useI18n()
const say = usePhrase()

const { live } = useFleet()
const machine = ref<MachineReading | null>(null)
const budget = ref<BudgetSettings | null>(null)

const gauges = computed(() => gaugesOf(machine.value?.snapshot ?? null))
const spent = computed(() => budget.value?.spentUsd ?? 0)
const cap = computed(() => budget.value?.policy.capUsd ?? 0)

const memoryFreeMb = computed(() => machine.value?.snapshot?.memoryFreeMb ?? null)
const room = computed(() =>
  roomForSessions({
    capUsd: cap.value,
    spentUsd: spent.value,
    memoryFreeMb: memoryFreeMb.value,
    sessions: machine.value?.sessions ?? null,
  }),
)

function levelOf(percent: number | null): string {
  if (percent === null) {
    return 'bg-line'
  }
  if (percent >= 90) {
    return 'bg-red'
  }
  return percent >= 70 ? 'bg-orange' : 'bg-green'
}

async function look(): Promise<void> {
  const [reading, settings] = await Promise.allSettled([
    board.read<MachineReading>('/api/machine'),
    board.read<BudgetSettings>('/api/settings/budget'),
  ])
  machine.value = reading.status === 'fulfilled' ? reading.value : null
  budget.value = settings.status === 'fulfilled' ? settings.value : null
}

let beat: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void look()
  beat = setInterval(() => void look(), 5000)
})

onBeforeUnmount(() => {
  if (beat !== null) {
    clearInterval(beat)
  }
})
</script>

<template>
  <div
    class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-hair px-4 py-2 text-xs text-txt-mid"
    role="group"
    :aria-label="t('forge.resource.aria')"
    data-test="forge-resources"
  >
    <span data-test="forge-resource-sessions">{{
      t('forge.resource.sessions', { count: live }, live)
    }}</span>
    <span v-if="gauges.length === 0" class="text-txt-low">{{ t('forge.resource.unknown') }}</span>
    <span v-for="gauge in gauges" :key="gauge.nameKey" class="flex items-center gap-1.5">
      <span class="text-txt-low">{{ t(gauge.nameKey) }}</span>
      <span class="h-1 w-8 overflow-hidden rounded-full bg-elev" aria-hidden="true">
        <span
          class="block h-full rounded-full"
          :class="levelOf(gauge.percent)"
          :style="{ width: `${Math.min(gauge.percent ?? 0, 100)}%` }"
        />
      </span>
      <span class="font-mono">{{ say(gauge.said) }}</span>
    </span>
    <span class="flex items-center gap-1.5">
      <span class="text-txt-low">{{ t('forge.resource.budget') }}</span>
      <span class="font-mono">{{
        t('forge.resource.budgetValue', { spent: spent.toFixed(2), cap: cap.toFixed(2) })
      }}</span>
    </span>
    <span :class="room > 0 ? 'text-green' : 'text-red'" data-test="forge-resource-room">
      {{ room > 0 ? t('forge.resource.room', { count: room }, room) : t('forge.resource.full') }}
    </span>
    <span class="flex-1" />
    <button
      type="button"
      class="rounded-md bg-transparent px-2.5 py-1 text-txt-hi hover:bg-elev"
      @click="emit('details')"
    >
      {{ t('forge.resource.details') }}
    </button>
  </div>
</template>
