import type { DemoState } from './DemoModel'

const MAPS = ['history', 'notes', 'links', 'threads', 'generation'] as const

const SETS = ['failedOnce', 'touched'] as const

const LISTS = ['projects', 'sheets', 'users', 'tags', 'epics', 'events', 'risks', 'decisions', 'columns', 'cards'] as const

type Saved = {
  self: DemoState['self']
  sequence: number
  lists: Record<string, unknown>
  maps: Record<string, [number, unknown][]>
  sets: Record<string, unknown[]>
  singletons: Record<string, unknown>
}

export function saveDemoState(state: DemoState): string {
  const saved: Saved = {
    self: state.self,
    sequence: state.sequence,
    lists: Object.fromEntries(LISTS.map((key) => [key, state[key]])),
    maps: Object.fromEntries(MAPS.map((key) => [key, [...state[key].entries()] as [number, unknown][]])),
    sets: Object.fromEntries(SETS.map((key) => [key, [...state[key]]])),
    singletons: Object.fromEntries([...state.touched].map((path) => [path, state.singletons[path]])),
  }
  return JSON.stringify(saved)
}

export function restoreDemoState(state: DemoState, raw: string): void {
  try {
    const saved = JSON.parse(raw) as Saved
    const target = state as unknown as Record<string, unknown>
    for (const key of LISTS) {
      target[key] = saved.lists[key]
    }
    for (const key of MAPS) {
      target[key] = new Map(saved.maps[key])
    }
    for (const key of SETS) {
      target[key] = new Set(saved.sets[key])
    }
    Object.assign(state.singletons, saved.singletons)
    state.self = saved.self
    state.sequence = saved.sequence
    for (const card of state.cards) {
      if (card.status === 'running') {
        card.status = 'to_validate'
      }
    }
  } catch {
    return
  }
}
