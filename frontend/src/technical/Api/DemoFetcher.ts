import { createDemoStore, DEMO_REFUSAL, type DemoStore } from './Demo/DemoStore.js'
import type { DemoEnvironment, DemoReply } from './Demo/DemoModel.js'

export type DemoSnapshot = Record<string, unknown>

export { DEMO_REFUSAL }

function respond({ status, body }: DemoReply): Response {
  if (body === null) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function bodyOf(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string' || init.body === '') {
    return null
  }
  try {
    return JSON.parse(init.body) as unknown
  } catch {
    return null
  }
}

export function createDemoFetcher(load: () => Promise<DemoSnapshot>, env: DemoEnvironment): typeof fetch {
  let loading: Promise<DemoStore> | null = null

  return async (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url
    loading = loading ?? load().then((snapshot) => createDemoStore(snapshot, env))
    const store = await loading
    return respond(store.handle(init?.method ?? 'GET', path, bodyOf(init)))
  }
}
