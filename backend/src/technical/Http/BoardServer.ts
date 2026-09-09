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
import { createPlaywrightPilot } from '../Browser/PlaywrightPilot.js'
import { createPilotShotApi } from './PilotShotApi.js'
import { createMachineApi } from '../../domain/Resource/MachineApi.js'
import { createStatisticRepository } from '../../domain/Statistic/StatisticRepository.js'
import { createStatisticApi } from '../../domain/Statistic/StatisticApi.js'
import { createIncidentRepository } from '../../domain/Incident/IncidentRepository.js'
import { createIncidentApi } from '../../domain/Incident/IncidentApi.js'
import { createEventBus } from './EventBus.js'
import { createBoardPage } from './BoardPage.js'
import { createSdkSessionRunner } from '../ClaudeCode/SdkSessionRunner.js'
import { recordUsageFromEvent } from '../ClaudeCode/UsageRecorder.js'
import { createTokenGuard } from '../Auth/TokenGuard.js'
import { deriveHookToken, resolveBoardToken } from '../Auth/BoardToken.js'
import { boardOrigins } from '../Auth/BoardOrigin.js'

const DEFAULT_SESSION_CAP = 3

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
  const api = createBoardApi({
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    repository: stories,
    agentSessions: sessions,
    checkpoints: createCheckpointRepository(db, { takeCensus: () => censusOfTree(testsDir) }),
    criteria: createCriterionRepository(db),
    events,
    dispatcher,
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
    createForemergeApi({ foremerge, events }),
  )
  guarded.route('/', createWorktreeApi({ worktrees, events }))
  guarded.route(
    '/',
    createPilotApi({
      pilots: createPilotRepository(db, {
        stories,
        driver: createPlaywrightPilot({ shotDir, headless: !headedPilot }),
      }),
      events,
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
          new Promise((closed) => {
            server.close(() => {
              db.close()
              closed()
            })
          }),
      })
    })
  })
}
