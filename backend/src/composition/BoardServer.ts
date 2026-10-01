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
import { createWorkflowRepository } from '../domain/Workflow/WorkflowRepository.js'
import { createWorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import { createWorkflowColumnApi } from '../domain/Workflow/WorkflowColumnApi.js'
import { DEFAULT_DISPATCH_RATE } from '../domain/Dispatch/DispatchRate.js'
import { createEvidenceFileReader } from '../technical/Evidence/EvidenceFileReader.js'
import { createBoardApi } from '../domain/Board/BoardApi.js'
import { advanceCascade } from '../domain/Checkpoint/ReviewCascade.js'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../domain/Identity/IdentityApi.js'
import { createOidcApi } from '../domain/Identity/OidcApi.js'
import { readAllowedDomains } from '../domain/Identity/ExternalIdentity.js'
import { readOidcProviders } from '../technical/Auth/OidcProvider.js'
import { createWorktreeRepository } from '../domain/Worktree/WorktreeRepository.js'
import { createWorktreeApi } from '../domain/Worktree/WorktreeApi.js'
import { createForgeCardRepository } from '../domain/ForgeCard/ForgeCardRepository.js'
import { createForgeCardApi } from '../domain/ForgeCard/ForgeCardApi.js'
import { createForgeBoardRepository } from '../domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardMover } from '../domain/ForgeCard/ForgeCardMover.js'
import { createForgeCardCloser } from '../domain/ForgeCard/ForgeCardCloser.js'
import { createForgeBoardApi } from '../domain/ForgeCard/ForgeBoardApi.js'
import { createStepEntry } from '../domain/Dispatch/StepEntry.js'
import { cleanUpAfterMerge } from '../domain/Deployment/MergeCleanup.js'
import { createCheckoutResolver, createProofGates } from './ProjectCheckout.js'
import { createGitWorktree } from '../technical/Git/GitWorktree.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createForemergeApi } from '../domain/Foremerge/ForemergeApi.js'
import { createPilotRepository } from '../domain/Pilot/PilotRepository.js'
import { createPilotApi } from '../domain/Pilot/PilotApi.js'
import { suggestParcours } from '../domain/Pilot/Parcours.js'
import { createPlaywrightPilot } from '../technical/Browser/PlaywrightPilot.js'
import { createPilotShotApi } from '../technical/Http/PilotShotApi.js'
import { createMachineApi } from '../domain/Resource/MachineApi.js'
import { createPreferenceApi } from '../domain/Preference/PreferenceApi.js'
import { createPreferenceRepository } from '../domain/Preference/PreferenceRepository.js'
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
import { mayAdministerProject } from '../domain/Project/ProjectAuthority.js'
import { readSuperAdminConfiguration } from '../technical/Auth/SuperAdminConfiguration.js'
import { createTemplateRepository } from '../domain/Template/TemplateRepository.js'
import { createTemplateApi } from '../domain/Template/TemplateApi.js'
import { createOutboxRepository } from '../domain/Boundary/OutboxRepository.js'
import { createBoundaryApi } from '../domain/Boundary/BoundaryApi.js'
import { createOrganisationRepository } from '../domain/Organisation/OrganisationRepository.js'
import { createOrganisationApi } from '../domain/Organisation/OrganisationApi.js'
import { createBatchRepository } from '../domain/Delivery/BatchRepository.js'
import { createBatchApi } from '../domain/Delivery/BatchApi.js'
import { columnAgentOfPhase, createDrivenRunner } from '../domain/Driver/Driver.js'
import { DEFAULT_FORGE_CARD_PROVIDER } from '../../../contract/ForgeCardContract.js'
import { createCodexSessionRunner } from '../technical/Codex/CodexSessionRunner.js'
import { codexDriver } from './CodexDriver.js'
import { createDriverApi } from '../domain/Driver/DriverApi.js'
import { claudeCodeDriver } from './ClaudeCodeDriver.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import { createConversationApi } from '../domain/Conversation/ConversationApi.js'
import { createMessageRepository } from '../domain/Conversation/MessageRepository.js'
import { recordMessageFromEvent } from '../domain/Conversation/MessageRecorder.js'
import { recordUsageFromEvent } from '../technical/ClaudeCode/UsageRecorder.js'
import { recordLifecycleFromEvent } from '../technical/ClaudeCode/LifecycleRecorder.js'
import { recordHeartbeatFromEvent } from '../technical/ClaudeCode/HeartbeatRecorder.js'
import { stopRunOverCap } from '../domain/Budget/CostGuard.js'
import type { BoardEvent } from '../technical/Http/EventBus.js'
import { createTokenGuard } from '../technical/Auth/TokenGuard.js'
import { createBrowserSessions } from '../technical/Auth/BrowserSession.js'
import { createSessionApi } from '../technical/Http/SessionApi.js'
import { deriveHookToken, resolveBoardToken } from '../technical/Auth/BoardToken.js'
import { requestBodyLimit } from '../technical/Http/RequestBodyLimit.js'
import { securityHeaders } from '../technical/Http/SecurityHeaders.js'
import { boardOrigins, isLocalOrigin } from '../technical/Auth/BoardOrigin.js'
import { isLoopbackPeer } from '../technical/Auth/ClientAddress.js'
import { ALLOW_REMOTE_LOCAL_ENV, assertLocalModeBinding } from '../technical/Auth/LocalBinding.js'

const DEFAULT_SESSION_CAP = 5

const sessionCap = Number(process.env.FORGE_SESSION_CAP ?? DEFAULT_SESSION_CAP)
const PURGE_EVERY_MS = 24 * 60 * 60 * 1000

const DEFAULT_MUTATION_TEST_COMMAND = 'npx vitest run'

const DEFAULT_RED_TEST_COMMAND = 'npx vitest run --reporter=json'

type ServerType = ReturnType<typeof serve>

const LOOPBACK = '127.0.0.1'

export type BoardServerInput = {
  port: number
  dbPath: string
  claudeHome: string
  host: string
  publicOrigin: string | null
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
    publicOrigin: process.env.FORGE_PUBLIC_ORIGIN ?? null,
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
  publicOrigin,
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
  assertLocalModeBinding(mode, host, process.env[ALLOW_REMOTE_LOCAL_ENV])
  const db = openDatabase(dbPath)
  const token = resolveBoardToken(tokenPath)
  const events = createEventBus()
  const allowedCheckoutRoots = [...checkoutRoots, resolve(worktreeRoot)]
  const forgeCards = createForgeCardRepository(db)
  const stories = createStoryRepository(db, {
    checkoutRoots: allowedCheckoutRoots,
    onBacklog: (story) => forgeCards.attachCardToStory(story.id),
  })
  stories.epics.purgeExpired()
  setInterval(() => stories.epics.purgeExpired(), PURGE_EVERY_MS).unref()
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
  const workflow = createWorkflowRepository(db)
  const workflowColumns = createWorkflowColumnRepository(db)
  const messages = createMessageRepository(db)
  const onSessionEvent = (event: BoardEvent): void => {
    recordUsageFromEvent(sessions, event)
    recordHeartbeatFromEvent(sessions, event)
    recordLifecycleFromEvent(sessions, event)
    recordMessageFromEvent({ sessions, messages }, event)
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
  const checkouts = createCheckoutResolver({
    stories,
    worktreePathOf: (storyId) => worktrees.findForStory(storyId)?.path ?? null,
  })
  const { cwdForStory } = checkouts
  const checkpointGates = createProofGates({
    readEvidence,
    testsDir,
    redCommand: process.env.FORGE_RED_TEST_COMMAND ?? DEFAULT_RED_TEST_COMMAND,
    mutationCommand: process.env.FORGE_MUTATION_TEST_COMMAND ?? DEFAULT_MUTATION_TEST_COMMAND,
    cwdForStory,
  })
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: process.cwd() }),
    root: worktreeRoot,
    checkoutOf: checkouts.checkoutOfStory,
  })
  const templates = createTemplateRepository(db)
  const outbox = createOutboxRepository(db)
  const organisations = createOrganisationRepository(db)
  const drivers = [
    claudeCodeDriver(
      createSdkSessionRunner({ cwdFor: (order) => cwdForStory(order.storyId), live, onEvent: onSessionEvent }),
    ),
    codexDriver(
      createCodexSessionRunner({ cwdFor: (order) => cwdForStory(order.storyId), onEvent: onSessionEvent }),
    ),
  ]
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, checkpointGates),
    criteria: createCriterionRepository(db),
    sessions,
    budget,
    foremerge,
    workflow,
    forgeCards,
    workflowColumns,
    runner: createDrivenRunner({
      drivers,
      providerOf: (order) =>
        order.provider ??
        (order.forgeCardId === undefined
          ? DEFAULT_FORGE_CARD_PROVIDER
          : forgeCards.findForgeCard(order.forgeCardId).provider),
      columnAgentOf: (order) =>
        columnAgentOfPhase(templates.templateOfProject(stories.projectOfStory(order.storyId)).columns, order.phase),
    }),
    concurrencyCap: sessionCap,
    claudeCodeVersion: process.env.CLAUDE_CODE_VERSION ?? 'unknown',
    rate: {
      burst: Number(process.env.FORGE_DISPATCH_BURST ?? DEFAULT_DISPATCH_RATE.burst),
      windowMs: Number(process.env.FORGE_DISPATCH_WINDOW_MS ?? DEFAULT_DISPATCH_RATE.windowMs),
    },
  })
  const cascadeCheckpoints = createCheckpointRepository(db, checkpointGates)
  const discussion = createDiscussionRepository(db, { stories })
  const batches = createBatchRepository(db)
  const identities = createIdentityRepository(db)
  const setupToken = process.env.FORGE_SETUP_TOKEN?.trim() || null
  const superAdminSeed = readSuperAdminConfiguration(process.env, undefined, (message) => console.warn(message))
  if (superAdminSeed !== null) {
    identities.bootstrapSuperAdmin(superAdminSeed)
  } else if (mode === 'hub') {
    console.warn(
      'No super admin configured: set FORGE_SUPER_ADMIN_LOGIN and FORGE_SUPER_ADMIN_PASSWORD (or FORGE_SUPER_ADMIN_PASSWORD_FILE); nobody can manage super admins and first enrolment stays closed until then (or set FORGE_SETUP_TOKEN).',
    )
  }
  const api = createBoardApi({
    isSuperAdmin: (login) => identities.findUser(login)?.superAdmin ?? false,
    isDirector: (login) => identities.findUser(login)?.role === 'director',
    maySettleBudget: (context) => {
      if (mode === 'local') {
        return true
      }
      const user = identities.findUser(operatorOf(context))
      return user?.superAdmin === true || user?.role === 'director'
    },
    openHolds: discussion.openHolds,
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

  const browserSessions = createBrowserSessions()
  const guarded = new Hono()
  guarded.use('*', securityHeaders())
  guarded.use('/api/*', requestBodyLimit())
  guarded.get('/health', (context) =>
    context.json({ role: process.env.FORGE_ROLE ?? 'instance', mode, ready: true }),
  )
  guarded.use(
    '/api/*',
    createTokenGuard({
      token,
      allowedOrigins: boardOrigins(host, port, publicOrigin),
      hookToken: deriveHookToken(token),
      requireIdentity: mode === 'hub',
      readIdentity: (sessionToken) => identities.readSession(sessionToken),
      readBrowserSession: (sessionToken) => browserSessions.isOpen(sessionToken),
      allowSessionExchange: mode === 'local',
      allowLocalAutologin: mode === 'local',
      isLocalOrigin: (origin) => isLocalOrigin(origin, host, port),
      isLoopbackPeer,
    }),
  )
  guarded.get('/api/auth/whoami', (context) => context.json({ authenticated: true }))
  if (mode === 'local') {
    guarded.route('/', createSessionApi({ token, sessions: browserSessions }))
  }
  guarded.route(
    '/',
    createIdentityApi({
      identities,
      allowEnrolment: () => identities.countUsers() === 0 && (mode !== 'hub' || setupToken !== null),
      setupToken,
    }),
  )
  guarded.route(
    '/',
    createOidcApi({
      identities,
      providers: readOidcProviders(),
      allowedDomains: readAllowedDomains(),
      publicOrigin,
    }),
  )
  guarded.route('/', createDriverApi({ drivers }))
  guarded.route(
    '/',
    createBoundaryApi({
      outbox,
      installedVersion: process.env.FORGE_VERSION ?? '0.1.0',
      offeredVersion: () => process.env.FORGE_OFFERED_VERSION ?? process.env.FORGE_VERSION ?? '0.1.0',
    }),
  )
  guarded.route(
    '/',
    createOrganisationApi({
      organisations,
      maySettle: (context) =>
        mode === 'local' || identities.findUser(operatorOf(context))?.role === 'director',
    }),
  )
  guarded.route(
    '/',
    createBatchApi({
      batches,
      maySettle: (context) =>
        mode === 'local' || identities.findUser(operatorOf(context))?.role === 'director',
    }),
  )
  guarded.route(
    '/',
    createTemplateApi({
      templates,
      maySettle: (context) =>
        mode === 'local' || identities.findUser(operatorOf(context))?.role === 'director',
    }),
  )
  guarded.route(
    '/',
    createWorkflowColumnApi({
      columns: workflowColumns,
      projectExists: (projectId) => stories.projects.find(projectId) !== null,
      mayAdminister: (projectId, context) =>
        mayAdministerProject({
          login: operatorOf(context),
          adminLogin: stories.projects.find(projectId)?.adminLogin ?? null,
          isSuperAdmin: (login) => identities.findUser(login)?.superAdmin ?? false,
          isDirector: (login) => identities.findUser(login)?.role === 'director',
        }),
      adminOf: (projectId) => {
        const sheet = stories.projects.find(projectId)
        return sheet === null || sheet.adminLogin === null
          ? null
          : { login: sheet.adminLogin, name: sheet.adminName ?? sheet.adminLogin }
      },
    }),
  )
  guarded.get('/api/board/mode', (context) =>
    context.json({
      mode,
      environment: environmentMode,
      localTrusted: mode === 'local' && isLocalOrigin(context.req.header('origin'), host, port),
    }),
  )
  guarded.route(
    '/',
    createConversationApi({
      stories,
      sessions,
      events,
      talker: createSdkSessionTalker({ live, onEvent: onSessionEvent }),
      discussion,
      checkpoints: cascadeCheckpoints,
      templates,
      messages,
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
  guarded.route('/', createWorktreeApi({ worktrees, stories, events }))
  guarded.route('/', createForgeCardApi({ forgeCards, worktrees, stories }))
  const pilotCriteria = createCriterionRepository(db)
  const forgeBoard = createForgeBoardRepository(db, { forgeCards, columns: workflowColumns })
  forgeBoard.backfillCards()
  guarded.route(
    '/',
    createForgeBoardApi({
      board: forgeBoard,
      forgeCards,
      stories,
      events,
      closer: createForgeCardCloser({
        board: forgeBoard,
        forgeCards,
        stories,
        columns: workflowColumns,
        checkpoints: cascadeCheckpoints,
        criteria: pilotCriteria,
        cleanUpAfterMerge: (storyId) =>
          cleanUpAfterMerge({
            storyId,
            releaseScope: foremerge.release,
            closeWorktree: (target) => worktrees.close(target, { deleteBranch: true }),
          }),
      }),
      mover: createForgeCardMover({
        board: forgeBoard,
        forgeCards,
        stories,
        columns: workflowColumns,
        enterStep: createStepEntry({ dispatcher, columns: workflowColumns }),
        launchStep: (entry) => dispatcher.dispatch(entry),
      }),
    }),
  )
  const pilots = createPilotRepository(db, {
    stories,
    openDriver: () => createPlaywrightPilot({ shotDir, headless: !headedPilot }),
  })
  pilots.abandonOrphans()
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
  guarded.route(
    '/',
    createPreferenceApi({
      preferences: createPreferenceRepository(db),
      userIdOf: (login) => identities.findUser(login)?.id ?? null,
    }),
  )
  guarded.route(
    '/',
    createMachineApi({
      metricsUrl,
      sessions: () => ({ running: dispatcher.countRunning(), cap: sessionCap }),
    }),
  )
  guarded.route(
    '/',
    createFileApi({
      stories,
      files: createFileRepository(db),
      checkoutRoots: allowedCheckoutRoots,
      mayAdminister: (projectId, context) =>
        mayAdministerProject({
          login: operatorOf(context),
          adminLogin: stories.projects.find(projectId)?.adminLogin ?? null,
          isSuperAdmin: (login) => identities.findUser(login)?.superAdmin ?? false,
          isDirector: (login) => identities.findUser(login)?.role === 'director',
        }),
    }),
  )
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
