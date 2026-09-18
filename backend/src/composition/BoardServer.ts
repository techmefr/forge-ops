import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { openDatabase } from '../technical/Database/Connection.js'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../domain/Checkpoint/CheckpointRepository.js'
import { createZoneRepository } from '../domain/Zone/ZoneRepository.js'
import { createCriterionRepository } from '../domain/Criterion/CriterionRepository.js'
import { createDispatcher } from '../domain/Dispatch/Dispatcher.js'
import { createBudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { DEFAULT_DISPATCH_RATE } from '../domain/Dispatch/DispatchRate.js'
import { censusOfTree } from '../technical/Tamper/TestTreeCensus.js'
import { createEvidenceFileReader } from '../technical/Evidence/EvidenceFileReader.js'
import { createCommandTestRunner, runMutationCheck } from '../technical/Mutation/MutationRun.js'
import { runRedReport } from '../technical/RedProof/RedProofRun.js'
import { createBoardApi } from '../domain/Board/BoardApi.js'
import { advanceCascade } from '../domain/Checkpoint/ReviewCascade.js'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../domain/Identity/IdentityApi.js'
import { createWorktreeRepository } from '../domain/Worktree/WorktreeRepository.js'
import { createWorktreeApi } from '../domain/Worktree/WorktreeApi.js'
import { cleanUpAfterMerge } from '../domain/Deployment/MergeCleanup.js'
import { createGitWorktree } from '../technical/Git/GitWorktree.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createForemergeApi } from '../domain/Foremerge/ForemergeApi.js'
import { createPilotRepository } from '../domain/Pilot/PilotRepository.js'
import { createPilotApi } from '../domain/Pilot/PilotApi.js'
import { suggestParcours } from '../domain/Pilot/Parcours.js'
import { createPlaywrightPilot } from '../technical/Browser/PlaywrightPilot.js'
import { createPilotShotApi } from '../technical/Http/PilotShotApi.js'
import { createMachineApi } from '../domain/Resource/MachineApi.js'
import { createFileApi } from '../domain/File/FileApi.js'
import { createFileRepository } from '../domain/File/FileRepository.js'
import { createStatisticRepository } from '../domain/Statistic/StatisticRepository.js'
import { createStatisticApi } from '../domain/Statistic/StatisticApi.js'
import { createIncidentRepository } from '../domain/Incident/IncidentRepository.js'
import { createIncidentApi } from '../domain/Incident/IncidentApi.js'
import { createEventBus } from '../technical/Http/EventBus.js'
import { createBoardPage } from '../technical/Http/BoardPage.js'
import { createSdkSessionRunner, createSdkSessionTalker } from '../technical/ClaudeCode/SdkSessionRunner.js'
import { createLiveSessions } from '../technical/ClaudeCode/LiveSessions.js'
import { createDiscussionApi } from '../domain/Discussion/DiscussionApi.js'
import { createDiscussionRepository } from '../domain/Discussion/DiscussionRepository.js'
import { operatorOf } from '../technical/Auth/BoardIdentity.js'
import { createTemplateRepository } from '../domain/Template/TemplateRepository.js'
import { createTemplateApi } from '../domain/Template/TemplateApi.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import { createConversationApi } from '../domain/Conversation/ConversationApi.js'
import { recordUsageFromEvent } from '../technical/ClaudeCode/UsageRecorder.js'
import { recordLifecycleFromEvent } from '../technical/ClaudeCode/LifecycleRecorder.js'
import { recordHeartbeatFromEvent } from '../technical/ClaudeCode/HeartbeatRecorder.js'
import { stopRunOverCap } from '../domain/Budget/CostGuard.js'
import type { BoardEvent } from '../technical/Http/EventBus.js'
import { createTokenGuard } from '../technical/Auth/TokenGuard.js'
import { createBrowserSessions } from '../technical/Auth/BrowserSession.js'
import { createSessionApi } from '../technical/Http/SessionApi.js'
import { deriveHookToken, resolveBoardToken } from '../technical/Auth/BoardToken.js'
import { boardOrigins } from '../technical/Auth/BoardOrigin.js'

const DEFAULT_SESSION_CAP = 5

const DEFAULT_MUTATION_TEST_COMMAND = 'npx vitest run'

const DEFAULT_RED_TEST_COMMAND = 'npx vitest run --reporter=json'

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
  checkoutRoots: readonly string[]
  shotDir: string
  headedPilot: boolean
  metricsUrl: string | null
  mode: BoardMode
  environmentMode: EnvironmentMode
}

export type BoardMode = 'local' | 'hub'

export type EnvironmentMode = 'demo' | 'real'

export type BoardServer = {
  server: ServerType
  port: number
  close: () => Promise<void>
}

function readCheckoutRoots(): readonly string[] {
  const declared = process.env.FORGE_CHECKOUT_ROOTS
  if (declared === undefined || declared.trim() === '') {
    return [process.cwd()]
  }
  return declared
    .split(':')
    .map((root) => root.trim())
    .filter((root) => root !== '')
    .map((root) => resolve(root))
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
    checkoutRoots: readCheckoutRoots(),
    shotDir: process.env.FORGE_SHOT_DIR ?? join('..', 'forge-shots'),
    headedPilot: process.env.FORGE_PILOT_HEADED === 'true',
    metricsUrl: process.env.FORGE_OTEL_METRICS_URL ?? null,
    mode: process.env.FORGE_MODE === 'hub' ? 'hub' : 'local',
    environmentMode: 'real',
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
  checkoutRoots,
  shotDir,
  headedPilot,
  metricsUrl,
  mode,
  environmentMode,
}: BoardServerInput): Promise<BoardServer> {
  const db = openDatabase(dbPath)
  const token = resolveBoardToken(tokenPath)
  const events = createEventBus()
  const allowedCheckoutRoots = [...checkoutRoots, resolve(worktreeRoot)]
  const stories = createStoryRepository(db, { checkoutRoots: allowedCheckoutRoots })
  const readEvidence = createEvidenceFileReader({
    root: process.cwd(),
    evidenceRoot: join('.claude', 'evidence'),
  })
  const sessions = createAgentSessionRepository(db)
  const abandoned = sessions.abandonRunningSessions()
  if (abandoned > 0) {
    console.log(`${abandoned} session${abandoned > 1 ? 's' : ''} orpheline${abandoned > 1 ? 's' : ''} liberee${abandoned > 1 ? 's' : ''}`)
  }
  const foremerge = createForemergeRepository(db, { stories })
  const live = createLiveSessions<SdkUserTurn>()
  const budget = createBudgetRepository(db)
  const onSessionEvent = (event: BoardEvent): void => {
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
    events.publish(event)
  }
  const checkpointGates = {
    takeCensus: () => censusOfTree(testsDir),
    readEvidence,
    surveyRed: () =>
      runRedReport({
        command: process.env.FORGE_RED_TEST_COMMAND ?? DEFAULT_RED_TEST_COMMAND,
        cwd: process.cwd(),
      }),
    surveyMutations: (paths: readonly string[]) =>
      runMutationCheck({
        paths,
        runTests: createCommandTestRunner({
          command: process.env.FORGE_MUTATION_TEST_COMMAND ?? DEFAULT_MUTATION_TEST_COMMAND,
          cwd: process.cwd(),
        }),
      }),
  }
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: process.cwd() }),
    root: worktreeRoot,
  })
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, checkpointGates),
    criteria: createCriterionRepository(db),
    sessions,
    budget,
    foremerge,
    runner: createSdkSessionRunner({ cwd: process.cwd(), live, onEvent: onSessionEvent }),
    concurrencyCap: Number(process.env.FORGE_SESSION_CAP ?? DEFAULT_SESSION_CAP),
    claudeCodeVersion: process.env.CLAUDE_CODE_VERSION ?? 'unknown',
    rate: {
      burst: Number(process.env.FORGE_DISPATCH_BURST ?? DEFAULT_DISPATCH_RATE.burst),
      windowMs: Number(process.env.FORGE_DISPATCH_WINDOW_MS ?? DEFAULT_DISPATCH_RATE.windowMs),
    },
  })
  const cascadeCheckpoints = createCheckpointRepository(db, checkpointGates)
  const discussion = createDiscussionRepository(db, { stories })
  const templates = createTemplateRepository(db)
  const api = createBoardApi({
    openHolds: discussion.openHolds,
    boardColumns: () =>
      templates.defaultTemplate().columns.map((column) => ({
        key: column.state,
        label: column.label,
        colour: column.colour,
      })),
    today: () => new Date().toISOString().slice(0, 10),
    zones: createZoneRepository(db),
    budget,
    repository: stories,
    agentSessions: sessions,
    checkpoints: createCheckpointRepository(db, checkpointGates),
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
  const browserSessions = createBrowserSessions()
  const guarded = new Hono()
  guarded.use(
    '/api/*',
    createTokenGuard({
      token,
      allowedOrigins: boardOrigins(host, port),
      hookToken: deriveHookToken(token),
      requireIdentity: mode === 'hub',
      readIdentity: (sessionToken) => identities.readSession(sessionToken),
      readBrowserSession: (sessionToken) => browserSessions.isOpen(sessionToken),
      allowSessionExchange: mode === 'local',
    }),
  )
  if (mode === 'local') {
    guarded.route('/', createSessionApi({ token, sessions: browserSessions }))
  }
  guarded.route(
    '/',
    createIdentityApi({ identities, allowEnrolment: () => identities.countUsers() === 0 }),
  )
  guarded.route(
    '/',
    createTemplateApi({
      templates,
      maySettle: (context) =>
        mode === 'local' || identities.findUser(operatorOf(context))?.role === 'director',
    }),
  )
  guarded.get('/api/board/mode', (context) =>
    context.json({ mode, environment: environmentMode }),
  )
  guarded.route(
    '/',
    createConversationApi({
      stories,
      sessions,
      events,
      talker: createSdkSessionTalker({ live, onEvent: onSessionEvent }),
    }),
  )
  guarded.route(
    '/',
    createDiscussionApi({
      stories,
      discussion,
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
  guarded.route('/', createFileApi({ stories, files: createFileRepository(db), checkoutRoots: allowedCheckoutRoots }))
  guarded.route('/', createStatisticApi({ statistics: createStatisticRepository(db) }))
  guarded.route('/', createIncidentApi({ incidents: createIncidentRepository(db, { stories }), events }))
  guarded.route('/', api)
  guarded.route('/', createBoardPage({ distDir }))

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
