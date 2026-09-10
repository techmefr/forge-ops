import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createWorktreeRepository } from '../../../src/domain/Worktree/WorktreeRepository.js'
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { cleanUpAfterMerge } from '../../../src/domain/Deployment/MergeCleanup.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'

let api: Hono
let stories: StoryRepository
let storyId: number
let removed: string[]
let deletedBranches: string[]
let seen: BoardEvent[]
let foremerge: ReturnType<typeof createForemergeRepository>
let worktrees: ReturnType<typeof createWorktreeRepository>

function markDone(id: number): Promise<Response> {
  return api.request(`/api/stories/${id}/done`, { method: 'POST' }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  removed = []
  deletedBranches = []
  seen = []
  const events = createEventBus()
  events.subscribe((event) => seen.push(event))
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que' }).id
  foremerge = createForemergeRepository(db, { stories })
  worktrees = createWorktreeRepository(db, {
    stories,
    git: {
      headSha: () => 'sha',
      addWorktree: () => undefined,
      removeWorktree: (path) => {
        removed.push(path)
      },
      deleteBranch: (branch) => {
        deletedBranches.push(branch)
      },
      isDirty: () => false,
    },
    root: '/tmp/forge-worktrees',
  })
  const checkpoints = createCheckpointRepository(db, {
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  api = createBoardApi({
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints,
    criteria: createCriterionRepository(db),
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events,
    dispatcher: createDispatcher({
      database: db,
      stories,
      checkpoints,
      criteria: createCriterionRepository(db),
      sessions: createAgentSessionRepository(db),
      budget: createBudgetRepository(db),
      foremerge,
      runner: { launch: () => Promise.resolve({ claudeSessionId: 'fake' }) },
      concurrencyCap: 2,
      claudeCodeVersion: '2.1.224',
    }),
    cleanUpAfterMerge: (id) =>
      cleanUpAfterMerge({
        storyId: id,
        releaseScope: foremerge.release,
        closeWorktree: (target) => worktrees.close(target, { deleteBranch: true }),
      }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
    claudeHome: mkdtempSync(join(tmpdir(), 'starfleet-claude-home-')),
  })
})

describe('POST /api/stories/:id/done', () => {
  it('frees the scope the story was holding', async () => {
    foremerge.reserve({ storyId, pathPrefix: 'backend/src/domain/Mail', symbols: [] })

    await markDone(storyId)

    expect(foremerge.listReservations()).toEqual([])
  })

  it('removes the worktree, so the folder does not rot after the merge', async () => {
    worktrees.open({ storyId, baseRef: 'forge' })

    await markDone(storyId)

    expect(removed).toEqual(['/tmp/forge-worktrees/story-forge-1-visualiser-les-mails'])
  })

  it('deletes the branch, the work is in the integration branch now', async () => {
    worktrees.open({ storyId, baseRef: 'forge' })

    await markDone(storyId)

    expect(deletedBranches).toEqual(['story/forge-1-visualiser-les-mails'])
  })

  it('says what it cleaned up in the answer', async () => {
    foremerge.reserve({ storyId, pathPrefix: 'backend/src', symbols: [] })
    worktrees.open({ storyId, baseRef: 'forge' })

    const response = await markDone(storyId)

    await expect(response.json()).resolves.toMatchObject({
      cleanUp: { scopesReleased: 1, worktreeClosed: true },
    })
  })

  it('announces the merge, so every open board refreshes', async () => {
    await markDone(storyId)

    expect(seen.map((event) => event.name)).toContain('story.merged')
  })

  it('merges a story that never opened a worktree without complaining', async () => {
    const response = await markDone(storyId)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ cleanUp: { worktreeClosed: false } })
  })

  it('does not free the scope of another story', async () => {
    const other = stories.writeStory({
      epicId: stories.listEpics(1)[0]?.id ?? 1,
      title: 'supprimer les mails',
      body: 'en tant que',
    }).id
    foremerge.reserve({ storyId: other, pathPrefix: 'frontend/src', symbols: [] })

    await markDone(storyId)

    expect(foremerge.listReservations()).toHaveLength(1)
  })
})
