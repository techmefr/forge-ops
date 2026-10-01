import { computed, onScopeDispose, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import type { Fleet, FleetJob, MachineReading } from '@/domain/Board/BoardModel'

const WORKING_STATES = ['starting', 'working', 'running', 'busy']

export function isWorking(job: FleetJob): boolean {
  return WORKING_STATES.includes(job.state)
}

export function liveSessionCount(machine: MachineReading | null, workingJobs: number): number {
  return machine?.sessions?.running ?? workingJobs
}

export function useFleet(everyMs = 5000) {
  const fleet = ref<Fleet | null>(null)
  const machine = ref<MachineReading | null>(null)

  async function refresh(): Promise<void> {
    const [jobs, reading] = await Promise.allSettled([
      board.read<Fleet>('/api/fleet'),
      board.read<MachineReading>('/api/machine'),
    ])
    fleet.value = jobs.status === 'fulfilled' ? jobs.value : null
    machine.value = reading.status === 'fulfilled' ? reading.value : null
  }

  const timer = window.setInterval(() => void refresh(), everyMs)
  onScopeDispose(() => window.clearInterval(timer))
  void refresh()

  const working = computed(() => (fleet.value?.jobs ?? []).filter(isWorking))

  return {
    fleet,
    working,
    live: computed(() => liveSessionCount(machine.value, working.value.length)),
    refresh,
  }
}
