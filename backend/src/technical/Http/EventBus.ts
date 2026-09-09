export type BoardEvent = {
  name: string
  payload: Record<string, unknown>
}

export type EventListener = (event: BoardEvent) => void

export type EventBus = {
  publish: (event: BoardEvent) => void
  subscribe: (listener: EventListener) => () => void
  countSubscribers: () => number
}

export function createEventBus(): EventBus {
  const listeners = new Set<EventListener>()

  return {
    publish: (event) => {
      for (const listener of [...listeners]) {
        try {
          listener(event)
        } catch {
          listeners.delete(listener)
        }
      }
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    countSubscribers: () => listeners.size,
  }
}
