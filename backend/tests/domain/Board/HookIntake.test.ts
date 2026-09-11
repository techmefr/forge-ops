import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import {
  createZoneRepository,
  type ZoneRepository,
} from '../../../src/domain/Zone/ZoneRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

const stubDispatch = {
  dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
  countRunning: () => 0,
}


const CLAUDE_SESSION_ID = '9fe24018-1111-2222-3333-444455556666'

let api: Hono
let agentSessions: AgentSessionRepository
let zones: ZoneRepository
let projectId: number
let storyId: number

function postHook(payload: unknown): Promise<Response> {
  return api.request('/api/hooks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<Response>
}

function postToolUse(toolName: string, filePath?: string, sessionId: string = CLAUDE_SESSION_ID): Promise<Response> {
  return postHook({
    session_id: sessionId,
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: filePath === undefined ? {} : { file_path: filePath },
    cwd: '/home/gaetan/forge-ops',
  })
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  })
  projectId = project.id
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  zones = createZoneRepository(db)
  agentSessions = createAgentSessionRepository(db)
  agentSessions.registerSession({
    storyId,
    claudeSessionId: CLAUDE_SESSION_ID,
    phase: 'code',
    agentName: 'neo',
    claudeCodeVersion: '2.1.218',
  })
  api = createBoardApi({
    zones,
    budget: createBudgetRepository(db),
    repository: stories,
    agentSessions,
    checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    events: createEventBus(),
    dispatcher: stubDispatch,
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
  })
})

describe('POST /api/hooks', () => {
  it('attributes an edited file to the story of the session', async () => {
    const response = await postToolUse('Edit', 'src/domain/Story/Story.ts')

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ recorded: true })
    expect(agentSessions.listTouchedPaths(storyId)).toEqual(['src/domain/Story/Story.ts'])
  })

  it('records a written file too', async () => {
    await postToolUse('Write', 'src/domain/Board/BoardApi.ts')

    expect(agentSessions.listTouchedPaths(storyId)).toEqual(['src/domain/Board/BoardApi.ts'])
  })

  it('ignores a tool that does not touch a file', async () => {
    const response = await postToolUse('Bash')

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ recorded: false })
    expect(agentSessions.listTouchedPaths(storyId)).toEqual([])
  })

  it('ignores an edit whose payload carries no path', async () => {
    await postToolUse('Edit')

    expect(agentSessions.listTouchedPaths(storyId)).toEqual([])
  })

  it('accepts a hook from a session the board does not own, without recording it', async () => {
    const response = await postToolUse('Edit', 'src/index.ts', 'a-session-the-board-never-dispatched')

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ recorded: false })
    expect(agentSessions.listTouchedPaths(storyId)).toEqual([])
  })

  it('accepts an event it has no use for', async () => {
    const response = await postHook({
      session_id: CLAUDE_SESSION_ID,
      hook_event_name: 'Stop',
      cwd: '/home/gaetan/forge-ops',
    })

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ recorded: false })
  })

  it('refuses a payload that is not a hook', async () => {
    const response = await postHook({ nothing: 'useful' })

    expect(response.status).toBe(422)
  })
})

describe('GET /api/files/conflicts', () => {
  it('reports the paths two stories are editing at once', async () => {
    const db = openDatabase(':memory:')
    const stories = createStoryRepository(db)
    const project = stories.createProject({
      slug: 'forge',
      name: 'Forge',
      repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
      integrationBranch: 'forge',
      colour: '#ff3b00',
    })
    const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
    const first = stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' }).id
    const second = stories.writeStory({ epicId: epic.id, title: 'creer', body: 'en tant que...' }).id
    const sessions = createAgentSessionRepository(db)
    sessions.registerSession({
      storyId: first,
      claudeSessionId: 'aaaa',
      phase: 'code',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })
    sessions.registerSession({
      storyId: second,
      claudeSessionId: 'bbbb',
      phase: 'code',
      agentName: 'trinity',
      claudeCodeVersion: '2.1.218',
    })
    sessions.recordFileTouch({ claudeSessionId: 'aaaa', path: 'src/domain/Story/Story.ts' })
    sessions.recordFileTouch({ claudeSessionId: 'bbbb', path: 'src/domain/Story/Story.ts' })
    const conflictApi = createBoardApi({
      zones: createZoneRepository(db),
      budget: createBudgetRepository(db),
      repository: stories,
      agentSessions: sessions,
      checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
      criteria: createCriterionRepository(db),
      events: createEventBus(),
      dispatcher: stubDispatch,
      claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
    })

    const response = await conflictApi.request('/api/files/conflicts')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { path: 'src/domain/Story/Story.ts', storyIds: [first, second] },
    ])
  })
})

describe('the zone digest after a hook', () => {
  it('describes the zone the touched file belongs to', async () => {
    zones.declareZone({ projectId, pathPrefix: 'src/domain/Story', name: 'Story', colour: '#ff3b00' })

    await postToolUse('Edit', 'src/domain/Story/Story.ts')

    expect(zones.findZone('src/domain/Story').summary).toContain('1 fichier')
  })

  it('names the story working in the zone', async () => {
    zones.declareZone({ projectId, pathPrefix: 'src/domain/Story', name: 'Story', colour: '#ff3b00' })

    await postToolUse('Edit', 'src/domain/Story/Story.ts')

    expect(zones.findZone('src/domain/Story').summary).toContain('FORGE-1')
  })

  it('rewrites the digest as the zone grows', async () => {
    zones.declareZone({ projectId, pathPrefix: 'src/domain/Story', name: 'Story', colour: '#ff3b00' })

    await postToolUse('Edit', 'src/domain/Story/Story.ts')
    await postToolUse('Edit', 'src/domain/Story/StoryApi.ts')

    expect(zones.findZone('src/domain/Story').summary).toContain('2 fichiers')
  })

  it('leaves a neighbouring zone alone', async () => {
    zones.declareZone({ projectId, pathPrefix: 'src/domain/Story', name: 'Story', colour: '#ff3b00' })
    zones.declareZone({ projectId, pathPrefix: 'src/domain/Mail', name: 'Mail', colour: '#00b3ff' })

    await postToolUse('Edit', 'src/domain/Story/Story.ts')

    expect(zones.findZone('src/domain/Mail').summary).toBeNull()
  })

  it('records a file that belongs to no zone all the same', async () => {
    const response = await postToolUse('Edit', 'src/technical/Http/BoardServer.ts')

    expect(response.status).toBe(202)
    expect(agentSessions.listTouchedPaths(storyId)).toEqual(['src/technical/Http/BoardServer.ts'])
  })
})
