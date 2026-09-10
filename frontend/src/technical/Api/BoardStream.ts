export type StreamedEvent = {
  name: string
  payload: Record<string, unknown>
}

export type StreamHandle = {
  close: () => void
}

export type StreamInput = {
  path?: string
  onEvent: (event: StreamedEvent) => void
  onError?: (reason: string) => void
  source?: (url: string) => EventSource
}

const WATCHED_EVENTS = [
  'story.written',
  'story.unblocked',
  'checkpoint.proven',
  'project.created',
  'epic.created',
  'incident.reported',
  'incident.accepted',
  'incident.refused',
  'budget.policy.written',
  'session.dispatched',
  'session.system',
  'session.assistant',
  'session.user',
  'session.result',
  'session.failed',
  'scope.reserved',
  'scope.released',
  'worktree.opened',
  'worktree.closed',
  'story.merged',
  'review.cascade',
  'pilot.started',
  'pilot.advanced',
  'pilot.paused',
  'pilot.resumed',
  'pilot.ended',
] as const

export function parseFrame(name: string, data: string): StreamedEvent | null {
  try {
    const payload: unknown = JSON.parse(data)
    if (typeof payload !== 'object' || payload === null) {
      return null
    }
    return { name, payload: payload as Record<string, unknown> }
  } catch {
    return null
  }
}

export function openBoardStream({
  path = '/api/events',
  onEvent,
  onError,
  source = (url) => new EventSource(url, { withCredentials: true }),
}: StreamInput): StreamHandle {
  const stream = source(path)

  for (const name of WATCHED_EVENTS) {
    stream.addEventListener(name, (frame) => {
      const parsed = parseFrame(name, (frame as MessageEvent<string>).data)
      if (parsed !== null) {
        onEvent(parsed)
      }
    })
  }

  stream.addEventListener('error', () => {
    onError?.('le flux du board est coupe')
  })

  return { close: () => stream.close() }
}
