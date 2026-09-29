import { createDemoState } from './DemoLoader'
import { FOLLOW_UP_ROUTES } from './DemoFollowUp'
import { FORGE_ROUTES } from './DemoForge'
import { SUBJECT_ROUTES } from './DemoSubjects'
import { TEAM_ROUTES } from './DemoTeam'
import { WORKFLOW_ROUTES } from './DemoWorkflow'
import { reply, refusal, type DemoEnvironment, type DemoReply, type DemoRoute } from './DemoModel'

export const DEMO_REFUSAL = {
  error: 'DemonstrationFigee',
  message:
    'This action needs a real board: the demonstration only keeps the changes of the screens it covers, in this browser tab.',
}

const ROUTES: readonly DemoRoute[] = [
  ...SUBJECT_ROUTES,
  ...FOLLOW_UP_ROUTES,
  ...TEAM_ROUTES,
  ...WORKFLOW_ROUTES,
  ...FORGE_ROUTES,
]

export type DemoStore = {
  handle: (method: string, url: string, body: unknown) => DemoReply
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

function filtered(payload: unknown, query: URLSearchParams): unknown {
  if (!Array.isArray(payload) || query.size === 0) {
    return payload
  }
  return payload.filter((item) => {
    if (typeof item !== 'object' || item === null) {
      return true
    }
    const record = item as Record<string, unknown>
    return [...query.entries()].every(([key, value]) => !(key in record) || String(record[key]) === value)
  })
}

export function createDemoStore(snapshot: Record<string, unknown>, env: DemoEnvironment): DemoStore {
  const state = createDemoState(snapshot)

  return {
    handle: (method, url, body) => {
      const [pathname = '', search = ''] = url.split('?')
      const query = new URLSearchParams(search)
      for (const candidate of ROUTES) {
        if (candidate.method !== method) {
          continue
        }
        const match = candidate.pattern.exec(pathname)
        if (match !== null) {
          return candidate.run({ state, env, match, query, body: bodyRecord(body) })
        }
      }
      if (method !== 'GET') {
        return reply(DEMO_REFUSAL, 409)
      }
      const held = state.singletons[url] ?? filtered(state.singletons[pathname], query)
      return held === undefined
        ? refusal(404, 'HorsVisite', `${url} is not part of the demonstration`)
        : reply(held)
    },
  }
}
