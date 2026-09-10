import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../Database/Connection.js'
import { createStoryRepository } from '../../domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../domain/Checkpoint/CheckpointRepository.js'
import { createZoneRepository } from '../../domain/Zone/ZoneRepository.js'
import { createCriterionRepository } from '../../domain/Criterion/CriterionRepository.js'
import { createDispatcher } from '../../domain/Dispatch/Dispatcher.js'
import { createBudgetRepository } from '../../domain/Budget/BudgetRepository.js'
import { DEFAULT_DISPATCH_RATE } from '../../domain/Dispatch/DispatchRate.js'
import { censusOfTree } from '../Tamper/TestTreeCensus.js'
import { createBoardApi } from '../../domain/Board/BoardApi.js'
import { advanceCascade } from '../../domain/Checkpoint/ReviewCascade.js'
import { createIdentityRepository } from '../../domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../domain/Identity/IdentityApi.js'
import { createWorktreeRepository } from '../../domain/Worktree/WorktreeRepository.js'
import { createWorktreeApi } from '../../domain/Worktree/WorktreeApi.js'
import { cleanUpAfterMerge } from '../../domain/Deployment/MergeCleanup.js'
import { createGitWorktree } from '../Git/GitWorktree.js'
import { createForemergeRepository } from '../../domain/Foremerge/ForemergeRepository.js'
import { createForemergeApi } from '../../domain/Foremerge/ForemergeApi.js'
import { createPilotRepository } from '../../domain/Pilot/PilotRepository.js'
import { createPilotApi } from '../../domain/Pilot/PilotApi.js'
import { suggestParcours } from '../../domain/Pilot/Parcours.js'
import { createPlaywrightPilot } from '../Browser/PlaywrightPilot.js'
import { createPilotShotApi } from './PilotShotApi.js'
import { createMachineApi } from '../../domain/Resource/MachineApi.js'
import { createStatisticRepository } from '../../domain/Statistic/StatisticRepository.js'
import { createStatisticApi } from '../../domain/Statistic/StatisticApi.js'
import { createIncidentRepository } from '../../domain/Incident/IncidentRepository.js'
import { createIncidentApi } from '../../domain/Incident/IncidentApi.js'
import { createEventBus } from './EventBus.js'
import { createBoardPage } from './BoardPage.js'
import { createSdkSessionRunner, createSdkSessionTalker } from '../ClaudeCode/SdkSessionRunner.js'
import { createLiveSessions } from '../ClaudeCode/LiveSessions.js'
import { createDiscussionApi } from '../../domain/Discussion/DiscussionApi.js'
import { createDiscussionRepository } from '../../domain/Discussion/DiscussionRepository.js'
import type { SdkUserTurn } from '../ClaudeCode/TurnDelivery.js'
import { createConversationApi } from '../../domain/Conversation/ConversationApi.js'
import { recordUsageFromEvent } from '../ClaudeCode/UsageRecorder.js'
import { createTokenGuard } from '../Auth/TokenGuard.js'
import { deriveHookToken, resolveBoardToken } from '../Auth/BoardToken.js'
import { boardOrigins } from '../Auth/BoardOrigin.js'

const DEFAULT_SESSION_CAP = 5

type ServerType = ReturnType<typeof serve>

const LOOPBACK = '127.0.0.1'

export type BoardServerInput = {
  port: number
  dbPath: string
  claudeHome: string
  host: string
  tokenPath: string
  distDir: string
  testsDir: string
  worktreeRoot: string
  shotDir: string
  headedPilot: boolean
  metricsUrl: string | null
  mode: BoardMode
}

export type BoardMode = 'local' | 'hub'

export type BoardServer = {
  server: ServerType
  port: number
  close: () => Promise<void>
}

export function defaultBoardServerInput(): BoardServerInput {
  return {
    port: Number(process.env.FORGE_PORT ?? 8830),
    dbPath: process.env.FORGE_DB_PATH ?? 'forge.db',
    claudeHome: process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'),
    host: process.env.FORGE_HOST ?? LOOPBACK,
    tokenPath: process.env.FORGE_TOKEN_PATH ?? '.forge-token',
    distDir: process.env.FORGE_DIST_DIR ?? join('dist', 'web'),
    testsDir: process.env.FORGE_TESTS_DIR ?? 'backend/tests',
    worktreeRoot: process.env.FORGE_WORKTREE_ROOT ?? join('..', 'forge-worktrees'),
    shotDir: process.env.FORGE_SHOT_DIR ?? join('..', 'forge-shots'),
    headedPilot: process.env.FORGE_PILOT_HEADED === 'true',
    metricsUrl: process.env.FORGE_OTEL_METRICS_URL ?? null,
    mode: process.env.FORGE_MODE === 'hub' ? 'hub' : 'local',
  }
}

export function startBoardServer({
  port,
  dbPath,
  claudeHome,
  host,
  tokenPath,
  distDir,
  testsDir,
  worktreeRoot,
  shotDir,
  headedPilot,
  metricsUrl,
  mode,
}: BoardServerInput): Promise<BoardServer> {
  const db = openDatabase(dbPath)
  const token = resolveBoardToken(tokenPath)
  const events = createEventBus()
  const stories = createStoryRepository(db)
  const sessions = createAgentSessionRepository(db)
  const foremerge = createForemergeRepository(db, { stories })
  const live = createLiveSessions<SdkUserTurn>()
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: process.cwd() }),
    root: worktreeRoot,
  })
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, { takeCensus: () => censusOfTree(testsDir) }),
    criteria: createCriterionRepository(db),
    sessions,
    budget: createBudgetRepository(db),
    foremerge,
    runner: createSdkSessionRunner({
      cwd: process.cwd(),
      live,
      onEvent: (event) => {
        recordUsageFromEvent(sessions, event)
        events.publish(event)
      },
    }),
    concurrencyCap: Number(process.env.FORGE_SESSION_CAP ?? DEFAULT_SESSION_CAP),
    claudeCodeVersion: process.env.CLAUDE_CODE_VERSION ?? 'unknown',
    rate: {
      burst: Number(process.env.FORGE_DISPATCH_BURST ?? DEFAULT_DISPATCH_RATE.burst),
      windowMs: Number(process.env.FORGE_DISPATCH_WINDOW_MS ?? DEFAULT_DISPATCH_RATE.windowMs),
    },
  })
  const cascadeCheckpoints = createCheckpointRepository(db, {
    takeCensus: () => censusOfTree(testsDir),
  })
  const api = createBoardApi({
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    repository: stories,
    agentSessions: sessions,
    checkpoints: createCheckpointRepository(db, { takeCensus: () => censusOfTree(testsDir) }),
    criteria: createCriterionRepository(db),
    events,
    dispatcher,
    advanceReviewCascade: (storyId) =>
      advanceCascade({
        cascade: cascadeCheckpoints.reviewCascade(storyId),
        dispatchLens: async (lens) => {
          await dispatcher.dispatch({ storyId, phase: 'review', lens })
        },
      }),
    cleanUpAfterMerge: (storyId) =>
      cleanUpAfterMerge({
        storyId,
        releaseScope: foremerge.release,
        closeWorktree: (target) => worktrees.close(target, { deleteBranch: true }),
      }),
    claudeHome,
  })

  const identities = createIdentityRepository(db)
  const guarded = new Hono()
  guarded.use(
    '/api/*',
    createTokenGuard({
      token,
      allowedOrigins: boardOrigins(host, port),
      hookToken: deriveHookToken(token),
      requireIdentity: mode === 'hub',
      readIdentity: (sessionToken) => identities.readSession(sessionToken),
    }),
  )
  guarded.route(
    '/',
    createIdentityApi({ identities, allowEnrolment: () => identities.countUsers() === 0 }),
  )
  guarded.get('/api/board/mode', (context) => context.json({ mode }))
  guarded.route(
    '/',
    createConversationApi({
      stories,
      sessions,
      events,
      talker: createSdkSessionTalker({
        cwd: process.cwd(),
        live,
        onResume: (claudeSessionId) => {
          if (sessions.findByClaudeSessionId(claudeSessionId) !== null) {
            sessions.carryUsage(claudeSessionId)
          }
        },
        onEvent: (event) => {
          recordUsageFromEvent(sessions, event)
          events.publish(event)
        },
      }),
    }),
  )
  guarded.route(
    '/',
    createDiscussionApi({
      stories,
      discussion: createDiscussionRepository(db, { stories }),
      events,
    }),
  )
  guarded.route(
    '/',
    createForemergeApi({ foremerge, events }),
  )
  guarded.route('/', createWorktreeApi({ worktrees, events }))
  const pilots = createPilotRepository(db, {
    stories,
    openDriver: () => createPlaywrightPilot({ shotDir, headless: !headedPilot }),
  })
  pilots.abandonOrphans()
  const pilotCriteria = createCriterionRepository(db)
  guarded.route(
    '/',
    createPilotApi({
      pilots,
      events,
      suggest: (storyId) =>
        suggestParcours({
          port: worktrees.findForStory(storyId)?.port ?? null,
          criteria: pilotCriteria.listCriteria(storyId),
        }),
    }),
  )
  guarded.route('/', createPilotShotApi({ shotDir }))
  guarded.route('/', createMachineApi({ metricsUrl }))
  guarded.route('/', createStatisticApi({ statistics: createStatisticRepository(db) }))
  guarded.route('/', createIncidentApi({ incidents: createIncidentRepository(db, { stories }), events }))
  guarded.route('/', api)
  guarded.route('/', createBoardPage({ token, distDir }))

  return new Promise((resolve) => {
    const server = serve({ fetch: guarded.fetch, port, hostname: host }, (address) => {
      resolve({
        server,
        port: address.port,
        close: () =>
          Promise.resolve(live.closeAll())
            .then(() => pilots.closeBrowsers())
            .then(
            () =>
              new Promise<void>((closed) => {
                server.close(() => {
                  db.close()
                  closed()
                })
              }),
          ),
      })
    })
  })
}
