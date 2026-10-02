import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { BudgetSettings, MachineReading } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { gaugesOf } from './MachineGauge'
import { roomForSessions } from './Estimate'

export type StatusLevel = 'unknown' | 'ok' | 'busy' | 'full'

const BEAT_MS = 5000
const BUSY_PERCENT = 70
const FULL_PERCENT = 90

export function levelOf(percents: readonly (number | null)[], room: number): StatusLevel {
  const known = percents.filter((percent): percent is number => percent !== null)
  if (room <= 0 || known.some((percent) => percent >= FULL_PERCENT)) {
    return 'full'
  }
  if (known.some((percent) => percent >= BUSY_PERCENT)) {
    return 'busy'
  }
  return known.length === 0 ? 'unknown' : 'ok'
}

export function useResourceStatus() {
  const machine = ref<MachineReading | null>(null)
  const budget = ref<BudgetSettings | null>(null)

  const gauges = computed(() => gaugesOf(machine.value?.snapshot ?? null))
  const spent = computed(() => budget.value?.spentUsd ?? 0)
  const cap = computed(() => budget.value?.policy?.capUsd ?? 0)
  const room = computed(() =>
    roomForSessions({
      capUsd: cap.value,
      spentUsd: spent.value,
      memoryFreeMb: machine.value?.snapshot?.memoryFreeMb ?? null,
      sessions: machine.value?.sessions ?? null,
    }),
  )
  const level = computed(() =>
    levelOf(
      gauges.value.map((gauge) => gauge.percent),
      room.value,
    ),
  )

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
    beat = setInterval(() => void look(), BEAT_MS)
  })

  onBeforeUnmount(() => {
    if (beat !== null) {
      clearInterval(beat)
    }
  })

  return { gauges, spent, cap, room, level }
}
