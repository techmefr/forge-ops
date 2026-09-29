import { createDemoStore, DEMO_REFUSAL, type DemoStore } from './Demo/DemoStore.js'
import type { DemoEnvironment, DemoReply } from './Demo/DemoModel.js'

export type DemoSnapshot = Record<string, unknown>

export const DEMO_SESSION_KEY = 'forge.demo.session'

function savedSession(): string | null {
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY)
  } catch {
    return null
  }
}

function keepSession(store: DemoStore): void {
  try {
    window.sessionStorage.setItem(DEMO_SESSION_KEY, store.save())
  } catch {
    return
  }
}

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
    loading = loading ?? load().then((snapshot) => createDemoStore(snapshot, env, savedSession()))
    const store = await loading
    const method = init?.method ?? 'GET'
    const answer = store.handle(method, path, bodyOf(init))
    if (method !== 'GET' && answer.status < 400) {
      keepSession(store)
    }
    if (answer.status === 409 && (answer.body as { error?: string }).error === DEMO_REFUSAL.error) {
      env.emit({ name: 'demo.readonly', payload: {} })
    }
    return respond(answer)
  }
}
