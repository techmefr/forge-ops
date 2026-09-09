import { computed, onScopeDispose, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import type { Fleet, FleetJob } from '@/domain/Board/BoardModel'

const WORKING_STATES = ['starting', 'working', 'running', 'busy']

export function isWorking(job: FleetJob): boolean {
  return WORKING_STATES.includes(job.state)
}

export function useFleet(everyMs = 5000) {
  const fleet = ref<Fleet | null>(null)

  async function refresh(): Promise<void> {
    try {
      fleet.value = await board.read<Fleet>('/api/fleet')
    } catch {
      fleet.value = null
    }
  }

  const timer = window.setInterval(() => void refresh(), everyMs)
  onScopeDispose(() => window.clearInterval(timer))
  void refresh()

  return {
    fleet,
    working: computed(() => (fleet.value?.jobs ?? []).filter(isWorking)),
    refresh,
  }
}
