export type SseFrame = { name: string; data: string }

export type FetchEventSourceDeps = {
  fetcher: typeof fetch
  headers: () => Record<string, string>
  wait?: (ms: number) => Promise<void>
}

const BACKOFF_START_MS = 1000
const BACKOFF_CAP_MS = 30000

export function backoffOf(attempt: number): number {
  return Math.min(BACKOFF_START_MS * 2 ** attempt, BACKOFF_CAP_MS)
}

export function parseSseChunk(buffer: string): { frames: SseFrame[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  const frames: SseFrame[] = []
  for (const block of blocks) {
    let name = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        name = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''))
      }
    }
    if (data.length > 0) {
      frames.push({ name, data: data.join('\n') })
    }
  }
  return { frames, rest }
}

export type FetchEventSource = {
  addEventListener: (name: string, listener: (event: Event) => void) => void
  close: () => void
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export function createFetchEventSource(url: string, deps: FetchEventSourceDeps): FetchEventSource {
  const listeners = new Map<string, ((event: Event) => void)[]>()
  const wait = deps.wait ?? sleep
  const controller = new AbortController()
  let isClosed = false

  function emit(name: string, data: string): void {
    for (const listener of listeners.get(name) ?? []) {
      listener({ data } as unknown as Event)
    }
  }

  async function readOnce(): Promise<void> {
    const response = await deps.fetcher(url, {
      headers: { accept: 'text/event-stream', ...deps.headers() },
      signal: controller.signal,
    })
    if (!response.ok || response.body === null) {
      throw new Error(`stream refused with ${response.status}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSseChunk(buffer)
      buffer = parsed.rest
      for (const frame of parsed.frames) {
        emit(frame.name, frame.data)
      }
    }
  }

  async function run(): Promise<void> {
    let attempt = 0
    while (!isClosed) {
      try {
        await readOnce()
        attempt = 0
      } catch {
        if (isClosed) {
          return
        }
      }
      emit('error', '')
      await wait(backoffOf(attempt))
      attempt += 1
    }
  }

  void run()

  return {
    addEventListener: (name, listener) => {
      listeners.set(name, [...(listeners.get(name) ?? []), listener])
    },
    close: () => {
      isClosed = true
      controller.abort()
    },
  }
}
