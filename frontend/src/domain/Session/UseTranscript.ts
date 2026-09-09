import { onScopeDispose, ref, type Ref } from 'vue'
import { openBoardStream, type StreamedEvent } from '@/technical/Api/BoardStream'

export type Utterance = {
  name: string
  reference: string | null
  phase: string | null
  text: string | null
  costUsd: number | null
}

const SESSION_PREFIX = 'session.'

function stringOr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function collectUtterance(event: StreamedEvent): Utterance | null {
  if (!event.name.startsWith(SESSION_PREFIX)) {
    return null
  }
  const text = stringOr(event.payload.text)
  const cost = typeof event.payload.costUsd === 'number' ? event.payload.costUsd : null
  if (text === null && cost === null && event.name !== 'session.dispatched' && event.name !== 'session.failed') {
    return null
  }
  return {
    name: event.name,
    reference: stringOr(event.payload.reference),
    phase: stringOr(event.payload.phase),
    text: text ?? stringOr(event.payload.message),
    costUsd: cost,
  }
}

export function keepFor(utterances: readonly Utterance[], reference: string | null): readonly Utterance[] {
  return reference === null
    ? utterances
    : utterances.filter((utterance) => utterance.reference === null || utterance.reference === reference)
}

export function useTranscript(reference: Ref<string | null>) {
  const utterances = ref<Utterance[]>([])
  const broken = ref(false)

  const handle = openBoardStream({
    onEvent: (event) => {
      const utterance = collectUtterance(event)
      if (utterance !== null) {
        utterances.value = [...utterances.value, utterance]
      }
    },
    onError: () => {
      broken.value = true
    },
  })

  onScopeDispose(() => handle.close())

  return {
    utterances,
    broken,
    visible: () => keepFor(utterances.value, reference.value),
    clear: () => {
      utterances.value = []
    },
  }
}
