import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { buildTestBoard } from './TestBoard.js'

const EXPECTED_ROUTES = [
  'DELETE /api/epics/:id/claim',
  'DELETE /api/stories/:id/merge-conflict',
  'GET /api/board/columns',
  'GET /api/board/human-gates',
  'GET /api/board/kanban',
  'GET /api/board/phases',
  'GET /api/board/projects',
  'GET /api/board/self',
  'GET /api/events',
  'GET /api/files/conflicts',
  'GET /api/fleet',
  'GET /api/projects',
  'GET /api/projects/:id/epics',
  'GET /api/projects/:id/zones',
  'GET /api/sessions/stale',
  'GET /api/settings/budget',
  'GET /api/stories/:id/blockers',
  'GET /api/stories/:id/dod',
  'GET /api/stories/:id/report',
  'GET /api/stories/:id/review',
  'GET /api/stories/:id/ticket',
  'GET /api/stories/backlog',
  'POST /api/criteria/:id/satisfy',
  'POST /api/epics',
  'POST /api/epics/:id/claim',
  'POST /api/hooks',
  'POST /api/projects',
  'POST /api/stories',
  'POST /api/stories/:id/backlog',
  'POST /api/stories/:id/checkpoints',
  'POST /api/stories/:id/criteria',
  'POST /api/stories/:id/dependencies',
  'POST /api/stories/:id/dispatch',
  'POST /api/stories/:id/done',
  'POST /api/stories/:id/estimate',
  'POST /api/stories/:id/merge-conflict',
  'POST /api/stories/:id/plan/accept',
  'POST /api/stories/:id/review',
  'POST /api/stories/:id/review/:lens/pass',
  'POST /api/stories/:id/rollout',
  'POST /api/stories/:id/step-back',
  'POST /api/stories/:id/twin',
  'POST /api/zones',
  'POST /api/zones/summary',
  'PUT /api/settings/budget',
  'PUT /api/stories/:id',
]

describe('the board exposes one inventory whatever the subject split', () => {
  let db: Database.Database

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  function inventory(): readonly string[] {
    return [
      ...new Set(buildTestBoard(db).api.routes.map((route) => `${route.method} ${route.path}`)),
    ].sort()
  }

  it('carries every route the split moved out and every route that stayed', () => {
    expect(inventory()).toEqual(EXPECTED_ROUTES)
  })

  it('keeps every route under the /api prefix the token guard watches', () => {
    for (const route of inventory()) {
      expect(route.split(' ')[1]).toMatch(/^\/api\//)
    }
  })
})
