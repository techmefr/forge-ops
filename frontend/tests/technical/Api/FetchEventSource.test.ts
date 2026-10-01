import { describe, expect, it } from 'vitest'
import {
  backoffOf,
  createFetchEventSource,
  parseSseChunk,
} from '../../../src/technical/Api/FetchEventSource.js'

const encoder = new TextEncoder()

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('parseSseChunk', () => {
  it('reads complete frames and keeps the unfinished tail', () => {
    const { frames, rest } = parseSseChunk('event: a\ndata: {"x":1}\n\nevent: b\ndata: par')
    expect(frames).toEqual([{ name: 'a', data: '{"x":1}' }])
    expect(rest).toBe('event: b\ndata: par')
  })

  it('joins data lines, defaults the name and accepts crlf', () => {
    const { frames } = parseSseChunk('data: one\r\ndata: two\r\n\r\n')
    expect(frames).toEqual([{ name: 'message', data: 'one\ntwo' }])
  })

  it('skips comments and frames without data', () => {
    const { frames } = parseSseChunk(': ping\n\nevent: x\n\n')
    expect(frames).toEqual([])
  })
})

describe('backoffOf', () => {
  it('doubles and caps', () => {
    expect([0, 1, 2, 3].map(backoffOf)).toEqual([1000, 2000, 4000, 8000])
    expect(backoffOf(20)).toBe(30000)
  })
})

describe('createFetchEventSource', () => {
  it('sends the token, dispatches frames across chunks and reconnects with backoff', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = []
    const waits: number[] = []
    const seen: string[] = []
    let token = 'one'
    let source!: ReturnType<typeof createFetchEventSource>
    const done = new Promise<void>((resolve) => {
      source = createFetchEventSource('https://s/api/events', {
        fetcher: (async (url: string, init: RequestInit) => {
          calls.push({ url, headers: init.headers as Record<string, string> })
          if (calls.length === 3) {
            source.close()
            resolve()
            return new Response(streamOf(''), { status: 200 })
          }
          token = 'two'
          return calls.length === 1
            ? new Response(streamOf('event: story.written\nda', 'ta: {"id":1}\n\n'), { status: 200 })
            : new Response('no', { status: 500 })
        }) as unknown as typeof fetch,
        headers: () => ({ 'x-forge-identity': token }),
        wait: async (ms) => {
          waits.push(ms)
        },
      })
      source.addEventListener('story.written', (event) => seen.push((event as MessageEvent).data))
    })
    await done
    expect(calls[0]).toEqual({
      url: 'https://s/api/events',
      headers: { accept: 'text/event-stream', 'x-forge-identity': 'one' },
    })
    expect(calls[1]?.headers['x-forge-identity']).toBe('two')
    expect(seen).toEqual(['{"id":1}'])
    expect(waits).toEqual([1000, 2000])
  })

  it('emits an error event when the connection drops', async () => {
    let errors = 0
    const source = createFetchEventSource('u', {
      fetcher: (async () => new Response('no', { status: 401 })) as unknown as typeof fetch,
      headers: () => ({}),
      wait: async () => {
        source.close()
      },
    })
    source.addEventListener('error', () => {
      errors += 1
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(errors).toBe(1)
  })
})
