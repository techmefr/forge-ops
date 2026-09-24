import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'

const queried = vi.fn()
const resolved = vi.fn()

const REGISTERED = {
  effective: {
    hooks: {
      PreToolUse: [
        { hooks: [{ type: 'command', command: 'tsx', args: ['backend/src/technical/Guardrail/DenyHook.ts'] }] },
        { hooks: [{ type: 'command', command: 'tsx', args: ['backend/src/technical/Guardrail/ScopeHook.ts'] }] },
      ],
    },
  },
}

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (input: unknown) => queried(input),
  resolveSettings: (input: unknown) => resolved(input),
}))

const { openDatabase } = await import('../../src/technical/Database/Connection.js')
const { createStoryRepository } = await import('../../src/domain/Story/StoryRepository.js')
const { createAgentSessionRepository } = await import('../../src/domain/Agent/AgentSessionRepository.js')
const { createCheckpointRepository } = await import('../../src/domain/Checkpoint/CheckpointRepository.js')
const { createCriterionRepository } = await import('../../src/domain/Criterion/CriterionRepository.js')
const { createBudgetRepository } = await import('../../src/domain/Budget/BudgetRepository.js')
const { createForemergeRepository } = await import('../../src/domain/Foremerge/ForemergeRepository.js')
const { createForgeCardRepository } = await import('../../src/domain/ForgeCard/ForgeCardRepository.js')
const { createDispatcher } = await import('../../src/domain/Dispatch/Dispatcher.js')
const { createDrivenRunner, columnAgentOfPhase } = await import('../../src/domain/Driver/Driver.js')
const { claudeCodeDriver } = await import('../../src/composition/ClaudeCodeDriver.js')
const { createSdkSessionRunner } = await import('../../src/technical/ClaudeCode/SdkSessionRunner.js')
const { createLiveSessions } = await import('../../src/technical/ClaudeCode/LiveSessions.js')
const { createTemplateRepository } = await import('../../src/domain/Template/TemplateRepository.js')
const { createWorktreeRepository } = await import('../../src/domain/Worktree/WorktreeRepository.js')
const { createGitWorktree } = await import('../../src/technical/Git/GitWorktree.js')
const { createDiscussionRepository } = await import('../../src/domain/Discussion/DiscussionRepository.js')
const { createEventBus } = await import('../../src/technical/Http/EventBus.js')
const { createConversationApi } = await import('../../src/domain/Conversation/ConversationApi.js')
const { createSdkSessionTalker } = await import('../../src/technical/ClaudeCode/SdkSessionRunner.js')
const { recordUsageFromEvent } = await import('../../src/technical/ClaudeCode/UsageRecorder.js')
const { recordLifecycleFromEvent } = await import('../../src/technical/ClaudeCode/LifecycleRecorder.js')
const { recordHeartbeatFromEvent } = await import('../../src/technical/ClaudeCode/HeartbeatRecorder.js')
const { stopRunOverCap } = await import('../../src/domain/Budget/CostGuard.js')
const { PERMISSIVE_CHECKPOINT_GATES } = await import('../../src/domain/Checkpoint/PermissiveCheckpointGate.js')
const { SessionAlreadyRunningError } = await import('../../src/domain/Dispatch/DispatchViolation.js')
import type { SdkUserTurn } from '../../src/technical/ClaudeCode/TurnDelivery.js'
import type { BoardEvent } from '../../src/technical/Http/EventBus.js'

function conversationOf(sessionId: string): AsyncIterable<{ type: string; session_id: string }> {
  async function* once(): AsyncGenerator<{ type: string; session_id: string }> {
    yield { type: 'system', session_id: sessionId }
    yield { type: 'result', session_id: sessionId }
  }
  const walking = once()
  return { [Symbol.asyncIterator]: () => walking }
}

function initGitRepo(root: string): void {
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'e2e@forge-ops.test'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'forge-ops e2e'], { cwd: root })
  writeFileSync(join(root, 'README.md'), 'depot de test pour le dispatch multi-colonnes\n')
  execFileSync('git', ['add', 'README.md'], { cwd: root })
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: root })
}

const CORPS_ETOFFE = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

type Board = {
  db: Database.Database
  dispatch: (phase: 'spec' | 'architecture' | 'tdd') => Promise<{ claudeSessionId: string }>
  storyId: number
  forgeCardId: number
  worktrees: ReturnType<typeof createWorktreeRepository>
  stories: ReturnType<typeof createStoryRepository>
  sessions: ReturnType<typeof createAgentSessionRepository>
  proveCheckpoint: (name: 'spec_done' | 'arch_done') => void
  threadOf: (storyId: number) => Promise<{ chapters: readonly { phase: string; claudeSessionId: string | null }[] }>
  events: BoardEvent[]
}

function bootBoard(repositoryRoot: string, worktreeRoot: string): Board {
  const db = openDatabase(':memory:')
  const events: BoardEvent[] = []
  const stories = createStoryRepository(db, { checkoutRoots: [repositoryRoot] })
  const sessions = createAgentSessionRepository(db)
  const criteria = createCriterionRepository(db)
  const budget = createBudgetRepository(db)
  const foremerge = createForemergeRepository(db, { stories })
  const forgeCards = createForgeCardRepository(db)
  const templates = createTemplateRepository(db)
  const discussion = createDiscussionRepository(db, { stories })
  const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  const live = createLiveSessions<SdkUserTurn>()
  const eventBus = createEventBus()
  eventBus.subscribe((event) => events.push(event))
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot }),
    root: worktreeRoot,
  })

  function cwdForStory(storyId: number): string {
    const worktree = worktrees.findForStory(storyId)
    if (worktree !== null) {
      return worktree.path
    }
    const projectId = stories.projectOfStory(storyId)
    const project = stories.listProjects().find((candidate) => candidate.id === projectId)
    return project?.checkoutPath ?? repositoryRoot
  }

  function onSessionEvent(event: BoardEvent): void {
    recordUsageFromEvent(sessions, event)
    recordHeartbeatFromEvent(sessions, event)
    recordLifecycleFromEvent(sessions, event)
    const { claudeSessionId } = event.payload
    if (typeof claudeSessionId === 'string' && claudeSessionId !== '') {
      stopRunOverCap(
        {
          sessions,
          stories,
          budget,
          hangUp: (identifier) => {
            live.close(identifier)
          },
        },
        claudeSessionId,
      )
    }
    eventBus.publish(event)
  }

  const drivers = [
    claudeCodeDriver(createSdkSessionRunner({ cwdFor: (order) => cwdForStory(order.storyId), live, onEvent: onSessionEvent })),
  ]

  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints,
    criteria,
    sessions,
    budget,
    foremerge,
    runner: createDrivenRunner({
      drivers,
      columnAgentOf: (order) =>
        columnAgentOfPhase(templates.templateOfProject(stories.projectOfStory(order.storyId)).columns, order.phase),
    }),
    concurrencyCap: 5,
    claudeCodeVersion: 'e2e-test',
    forgeCards,
  })

  const conversationApp = createConversationApi({
    stories,
    sessions,
    talker: createSdkSessionTalker({ live, onEvent: onSessionEvent }),
    events: eventBus,
    discussion,
    checkpoints,
    templates,
  })

  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  const story = stories.writeStory({
    epicId: epic.id,
    title: 'visualiser les mails du client concerne',
    body: CORPS_ETOFFE,
  })
  stories.writeTwin({ storyId: story.id, title: 'tests visualiser les mails', body: 'cas...' })
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-1', statement: 'le comportement attendu' })
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-2', statement: 'le cas vide est annonce' })
  stories.sendToBacklog(story.id)

  const forgeCard = forgeCards.createForgeCard({ storyIds: [story.id] })

  return {
    db,
    storyId: story.id,
    forgeCardId: forgeCard.id,
    worktrees,
    stories,
    sessions,
    events,
    proveCheckpoint: (name) => {
      const reference = stories.findStory(story.id).reference
      checkpoints.proveCheckpoint({
        storyId: story.id,
        name,
        evidencePath: `.claude/evidence/${reference}/${name}.md`,
      })
    },
    dispatch: (phase) => dispatcher.dispatch({ storyId: story.id, phase }),
    threadOf: async (storyId) => {
      const response = await conversationApp.request(`/api/stories/${storyId}/thread`)
      return (await response.json()) as { chapters: readonly { phase: string; claudeSessionId: string | null }[] }
    },
  }
}

describe('dispatch multi-colonnes d une forge card', () => {
  let repositoryRoot: string
  let worktreeRoot: string
  let board: Board

  beforeEach(() => {
    repositoryRoot = mkdtempSync(join(tmpdir(), 'forge-e2e-repo-'))
    worktreeRoot = mkdtempSync(join(tmpdir(), 'forge-e2e-worktrees-'))
    initGitRepo(repositoryRoot)
    queried.mockReset()
    resolved.mockReset()
    resolved.mockResolvedValue(REGISTERED)
    let turn = 0
    queried.mockImplementation(() => {
      turn += 1
      return conversationOf(`sess-${turn}`)
    })
    board = bootBoard(repositoryRoot, worktreeRoot)
  })

  afterEach(() => {
    board.db.close()
    rmSync(repositoryRoot, { recursive: true, force: true })
    rmSync(worktreeRoot, { recursive: true, force: true })
  })

  it('ouvre une session fraiche au premier dispatch, sans reprise', async () => {
    await board.dispatch('spec')

    const call = queried.mock.calls[0]?.[0] as { options: Record<string, unknown> }
    expect(call.options.resume).toBeUndefined()
  })

  it('reprend a chaque dispatch la session claude que la carte vient de rendre', async () => {
    const first = await board.dispatch('spec')
    expect(first.claudeSessionId).toBe('sess-1')

    finishRunning(board)
    board.proveCheckpoint('spec_done')
    const second = await board.dispatch('architecture')
    expect(queried.mock.calls[1]?.[0]).toMatchObject({ options: { resume: 'sess-1' } })
    expect(second.claudeSessionId).toBe('sess-2')

    finishRunning(board)
    board.proveCheckpoint('arch_done')
    const third = await board.dispatch('tdd')
    expect(queried.mock.calls[2]?.[0]).toMatchObject({ options: { resume: 'sess-2' } })
    expect(third.claudeSessionId).toBe('sess-3')
  })

  it('garde la forme FORGE-x (STORY-y) constante et fait avancer FORGE_PHASE colonne apres colonne', async () => {
    await board.dispatch('spec')
    finishRunning(board)
    board.proveCheckpoint('spec_done')
    await board.dispatch('architecture')
    finishRunning(board)
    board.proveCheckpoint('arch_done')
    await board.dispatch('tdd')

    const reference = board.stories.findStory(board.storyId).reference
    const expectedReference = new RegExp(`^FORGE-\\d+ \\(${reference}\\)$`)
    const envs = queried.mock.calls.map(
      (call) => (call[0] as { options: { env: Record<string, string> } }).options.env,
    )
    envs.forEach((env) => expect(env.FORGE_STORY_REFERENCE).toMatch(expectedReference))
    expect(envs.map((env) => env.FORGE_PHASE)).toEqual(['spec', 'architecture', 'tdd'])
  })

  it('conserve un seul et meme worktree pour la carte a travers les trois colonnes', async () => {
    const opened = board.worktrees.open({ storyId: board.storyId, forgeCardId: board.forgeCardId, baseRef: 'HEAD' })

    await board.dispatch('spec')
    finishRunning(board)
    board.proveCheckpoint('spec_done')
    await board.dispatch('architecture')
    const afterArchitecture = board.worktrees.findForStory(board.storyId)

    finishRunning(board)
    board.proveCheckpoint('arch_done')
    await board.dispatch('tdd')
    const afterTdd = board.worktrees.findForStory(board.storyId)

    expect(afterArchitecture?.id).toBe(opened.id)
    expect(afterArchitecture?.path).toBe(opened.path)
    expect(afterTdd?.id).toBe(opened.id)
    expect(afterTdd?.path).toBe(opened.path)
    expect(board.worktrees.listLive()).toHaveLength(1)
  })

  it('refuse un second dispatch concurrent sur la meme carte pendant qu une session tourne', async () => {
    await board.dispatch('spec')

    await expect(board.dispatch('spec')).rejects.toThrow(SessionAlreadyRunningError)
  })

  it('rend une seule discussion continue sur les trois colonnes deja dispatchees', async () => {
    await board.dispatch('spec')
    finishRunning(board)
    board.proveCheckpoint('spec_done')
    await board.dispatch('architecture')
    finishRunning(board)
    board.proveCheckpoint('arch_done')
    await board.dispatch('tdd')

    const thread = await board.threadOf(board.storyId)

    expect(thread.chapters.map((chapter) => chapter.phase)).toEqual(['spec', 'architecture', 'tdd'])
    expect(thread.chapters.map((chapter) => chapter.claudeSessionId)).toEqual(['sess-1', 'sess-2', 'sess-3'])
  })
})

function finishRunning(board: Board): void {
  const latest = board.sessions.latestSessionOf(board.storyId)
  if (latest !== null) {
    board.sessions.updateLifecycle(latest.claudeSessionId, 'finished')
  }
}
