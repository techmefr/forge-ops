import type { StreamedEvent } from './BoardStream.js'
import type { DemoEnvironment } from './Demo/DemoModel.js'

type Listener = (event: StreamedEvent) => void

const listeners = new Set<Listener>()

export function listenToDemoStream(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetDemo(): void {
  try {
    window.sessionStorage.removeItem('forge.demo.session')
  } catch {
    return
  } finally {
    window.location.reload()
  }
}

export const demoEnvironment: DemoEnvironment = {
  emit: (event) => {
    for (const listener of [...listeners]) {
      listener(event)
    }
  },
  later: (delayMs, work) => {
    window.setTimeout(work, delayMs)
  },
  now: () => new Date(),
}
