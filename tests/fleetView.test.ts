import { describe, expect, it } from 'vitest'
import { freshnessWindowMs, isFresh } from '../src/cache.js'
import { buildFileMap, isIdle, matchTask, plannedFor } from '../src/worktrees.js'
import { decideArbitration, isFrozen, isInHumanReview, orderPair } from '../src/conflicts.js'
import type { IArchNode, ITask, IWorktreeView } from '../src/types/task.js'

function task(overrides: Partial<ITask> = {}): ITask {
  return {
    id: 1,
    project: 'app',
    branch: 'feat/left',
    port: 4300,
    repoPath: '/repo',
    worktreePath: '/repo-worktrees/feat-left',
    runCommand: null,
    pid: null,
    feature: 'login',
    role: null,
    status: 'in_progress',
    lastCheckpoint: null,
    contextSummary: null,
    escalationReason: null,
    createdAt: '2026-08-07 10:00:00',
    updatedAt: '2026-08-07 10:00:00',
    ...overrides,
  }
}

function view(overrides: Partial<IWorktreeView> = {}): IWorktreeView {
  return {
    project: 'app',
    branch: 'feat/left',
    isMain: false,
    tracked: true,
    missing: false,
    port: 4300,
    feature: 'login',
    role: null,
    status: 'in_progress',
    lastCheckpoint: null,
    repoPath: '/repo',
    worktreePath: '/repo-worktrees/feat-left',
    base: 'main',
    head: 'abc123',
    clean: true,
    files: { touched: [], inProgress: [], planned: [] },
    lastActivity: null,
    idle: true,
    detail: null,
    ...overrides,
  }
}

function archNode(overrides: Partial<IArchNode> = {}): IArchNode {
  return {
    id: 1,
    project: 'app',
    path: 'src/planned.ts',
    purpose: null,
    status: 'planned',
    feature: 'login',
    createdAt: '2026-08-07 10:00:00',
    updatedAt: '2026-08-07 10:00:00',
    ...overrides,
  }
}

describe('freshnessWindowMs', () => {
  it('garde le TTL de base tant que le calcul reste rapide', () => {
    expect(freshnessWindowMs(120, 2000)).toBe(2000)
  })

  it('etire la fenetre quand le calcul depasse le TTL, sinon le cache nait perime', () => {
    expect(freshnessWindowMs(5000, 2000)).toBe(10000)
  })
})

describe('isFresh', () => {
  const now = 100000

  it('considere qu il n y a rien a servir sans cache', () => {
    expect(isFresh(null, now, 2000)).toBe(false)
  })

  // Le scenario exact de l emballement : un calcul de 5 s avec un TTL de 2 s.
  // Horodate au debut, l entree serait deja perimee a l ecriture et chaque
  // requete relancerait un scan complet.
  it('sert encore un cache dont le calcul a dure plus longtemps que le TTL', () => {
    expect(isFresh({ at: now - 4000, durationMs: 5000 }, now, 2000)).toBe(true)
  })

  it('finit par expirer, meme apres un calcul lent', () => {
    expect(isFresh({ at: now - 10001, durationMs: 5000 }, now, 2000)).toBe(false)
  })

  it('laisse au moins autant de repit que de travail', () => {
    const durationMs = 3000
    const window = freshnessWindowMs(durationMs, 2000)
    expect(window - durationMs).toBeGreaterThanOrEqual(durationMs)
  })
})

describe('isIdle', () => {
  const now = new Date('2026-08-07T12:00:00Z').getTime()

  it('treats a worktree that never emitted an event as idle', () => {
    expect(isIdle(null, now)).toBe(true)
  })

  it('keeps a worktree active while events keep arriving', () => {
    expect(isIdle('2026-08-07 11:58:00', now)).toBe(false)
  })

  it('falls back to idle when the session went silent', () => {
    expect(isIdle('2026-08-07 11:50:00', now)).toBe(true)
  })
})

describe('plannedFor', () => {
  it('keeps only the intentions of this worktree feature', () => {
    const nodes = [archNode(), archNode({ id: 2, path: 'src/other.ts', feature: 'billing' })]
    expect(plannedFor('login', nodes, new Set())).toEqual(['src/planned.ts'])
  })

  it('drops what the branch has already written: planned is intention, not fact', () => {
    expect(plannedFor('login', [archNode()], new Set(['src/planned.ts']))).toEqual([])
  })

  it('ignores a worktree with no feature, which owns no intention', () => {
    expect(plannedFor(null, [archNode()], new Set())).toEqual([])
  })
})

describe('matchTask', () => {
  const entry = {
    project: 'app',
    repoPath: '/repo',
    worktreePath: '/repo-worktrees/feat-left',
    branch: 'feat/left',
    head: 'abc123',
    isMain: false,
  }

  it('matches on the worktree path first', () => {
    const other = task({ id: 2, branch: 'feat/left', worktreePath: '/elsewhere' })
    expect(matchTask(entry, [other, task()])?.id).toBe(1)
  })

  it('falls back on repo and branch when the task predates the worktree', () => {
    const pending = task({ id: 3, worktreePath: null })
    expect(matchTask(entry, [pending])?.id).toBe(3)
  })

  it('falls back on project and branch, the key the dashboard already merges on', () => {
    const registered = task({ id: 4, repoPath: '/moved', worktreePath: null })
    expect(matchTask(entry, [registered])?.id).toBe(4)
  })

  it('returns null for a worktree nobody registered', () => {
    expect(matchTask({ ...entry, branch: 'feat/unknown', worktreePath: '/x' }, [task()])).toBeNull()
  })
})

describe('buildFileMap', () => {
  it('lists every branch writing a file, and flags the shared ones first', () => {
    const rows = buildFileMap([
      view({ files: { touched: ['src/shared.ts', 'src/left.ts'], inProgress: [], planned: [] } }),
      view({
        branch: 'feat/right',
        worktreePath: '/repo-worktrees/feat-right',
        files: { touched: [], inProgress: ['src/shared.ts'], planned: [] },
      }),
    ])
    expect(rows[0]?.path).toBe('src/shared.ts')
    expect(rows[0]?.shared).toBe(true)
    expect(rows[0]?.owners).toEqual([
      { branch: 'feat/left', worktreePath: '/repo-worktrees/feat-left', state: 'touched' },
      { branch: 'feat/right', worktreePath: '/repo-worktrees/feat-right', state: 'in_progress' },
    ])
    expect(rows[1]).toMatchObject({ path: 'src/left.ts', shared: false })
  })

  it('keeps the strongest level of certainty for one branch on one file', () => {
    const rows = buildFileMap([
      view({
        files: { touched: ['src/a.ts'], inProgress: ['src/a.ts'], planned: ['src/a.ts'] },
      }),
    ])
    expect(rows[0]?.owners).toEqual([
      { branch: 'feat/left', worktreePath: '/repo-worktrees/feat-left', state: 'in_progress' },
    ])
  })

  it('never merges two projects into the same row', () => {
    const rows = buildFileMap([
      view({ files: { touched: ['src/a.ts'], inProgress: [], planned: [] } }),
      view({
        project: 'api',
        branch: 'feat/api',
        files: { touched: ['src/a.ts'], inProgress: [], planned: [] },
      }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.shared === false)).toBe(true)
  })
})

describe('conflict promotion', () => {
  it('leaves a conflict unpromoted while both sides are still writing', () => {
    expect(isFrozen(task({ lastCheckpoint: 'plan_done' }))).toBe(false)
  })

  it('promotes once a side has stopped moving', () => {
    expect(isFrozen(task({ lastCheckpoint: 'reviewed' }))).toBe(true)
  })
})

describe('decideArbitration', () => {
  it('moves the side that is not in human review', () => {
    const left = task({ branch: 'feat/left', status: 'awaiting_human' })
    const right = task({ id: 2, branch: 'feat/right' })
    expect(decideArbitration(left, right)).toBe('feat/right')
    expect(decideArbitration(right, left)).toBe('feat/right')
  })

  it('leaves the call to the dev when neither side is in review', () => {
    expect(decideArbitration(task(), task({ id: 2, branch: 'feat/right' }))).toBeNull()
  })

  it('leaves the call to the dev when both sides are in review', () => {
    const left = task({ branch: 'feat/left', lastCheckpoint: 'mr_draft_pushed' })
    const right = task({ id: 2, branch: 'feat/right', status: 'awaiting_human' })
    expect(isInHumanReview(left)).toBe(true)
    expect(decideArbitration(left, right)).toBeNull()
  })
})

describe('orderPair', () => {
  it('orders the pair by branch name, so the conflict key stays stable', () => {
    const left = task({ branch: 'feat/left' })
    const right = task({ id: 2, branch: 'feat/right' })
    expect(orderPair(right, left).map((entry) => entry.branch)).toEqual(['feat/left', 'feat/right'])
    expect(orderPair(left, right).map((entry) => entry.branch)).toEqual(['feat/left', 'feat/right'])
  })
})
