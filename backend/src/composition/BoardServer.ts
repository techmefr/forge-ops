import { serve } from '@hono/node-server'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { openDatabase } from '../technical/Database/Connection.js'
import { mountAdministrationRoutes } from './AdministrationRoutes.js'
import { createAgentRuntime, sessionCap } from './AgentRuntime.js'
import { createForgeAutopilot } from './ForgeAutopilot.js'
import { createGuardedApp } from './GuardedApp.js'
import { createSessionEventSink } from './SessionEventSink.js'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createZoneRepository } from '../domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { createWorkflowRepository } from '../domain/Workflow/WorkflowRepository.js'
import { createWorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import { createProjectWorkflowRepository } from '../domain/Workflow/ProjectWorkflowRepository.js'
import { createEvidenceFileReader } from '../technical/Evidence/EvidenceFileReader.js'
import { createBoardApi } from '../domain/Board/BoardApi.js'
import { advanceCascade } from '../domain/Checkpoint/ReviewCascade.js'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createWorktreeApi } from '../domain/Worktree/WorktreeApi.js'
import { createForgeCardRepository } from '../domain/ForgeCard/ForgeCardRepository.js'
import { createForgeCardApi } from '../domain/ForgeCard/ForgeCardApi.js'
import { createForgeBoardApi } from '../domain/ForgeCard/ForgeBoardApi.js'
import { createAutopilotApi } from '../domain/Autopilot/AutopilotApi.js'
import { type AutopilotConductor } from '../domain/Autopilot/AutopilotConductor.js'
import { createAutopilotRepository } from '../domain/Autopilot/AutopilotRepository.js'
import { cleanUpAfterMerge } from '../domain/Deployment/MergeCleanup.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createForemergeApi } from '../domain/Foremerge/ForemergeApi.js'
import { createDestinationPolicy, parseAllowedOrigins } from '../domain/Pilot/PilotDestination.js'
import { createPilotRepository } from '../domain/Pilot/PilotRepository.js'
import { createPilotApi } from '../domain/Pilot/PilotApi.js'
import { suggestParcours } from '../domain/Pilot/Parcours.js'
import { createPlaywrightPilot } from '../technical/Browser/PlaywrightPilot.js'
import { createPilotShotApi } from '../technical/Http/PilotShotApi.js'
import { createMachineApi } from '../domain/Resource/MachineApi.js'
import { createPreferenceApi } from '../domain/Preference/PreferenceApi.js'
import { createPreferenceRepository } from '../domain/Preference/PreferenceRepository.js'
import { installGuardrails } from '../technical/Guardrail/GuardrailInstall.js'
import { createFileApi } from '../domain/File/FileApi.js'
import { createFileRepository } from '../domain/File/FileRepository.js'
import { createStatisticRepository } from '../domain/Statistic/StatisticRepository.js'
import { createStatisticApi } from '../domain/Statistic/StatisticApi.js'
import { createIncidentRepository } from '../domain/Incident/IncidentRepository.js'
import { createIncidentApi } from '../domain/Incident/IncidentApi.js'
import { createEventBus } from '../technical/Http/EventBus.js'
import { createBoardPage } from '../technical/Http/BoardPage.js'
import { createSdkSessionTalker } from '../technical/ClaudeCode/SdkSessionRunner.js'
import { createLiveSessions } from '../technical/ClaudeCode/LiveSessions.js'
import { createDiscussionApi } from '../domain/Discussion/DiscussionApi.js'
import { createDiscussionRepository } from '../domain/Discussion/DiscussionRepository.js'
import { operatorOf } from '../technical/Auth/BoardIdentity.js'
import { createBoardAccess } from './BoardAccess.js'
import { readSuperAdminConfiguration } from '../technical/Auth/SuperAdminConfiguration.js'
import { createTemplateRepository } from '../domain/Template/TemplateRepository.js'
import { createOutboxRepository } from '../domain/Boundary/OutboxRepository.js'
import { createOrganisationRepository } from '../domain/Organisation/OrganisationRepository.js'
import { createBatchRepository } from '../domain/Delivery/BatchRepository.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import { createConversationApi } from '../domain/Conversation/ConversationApi.js'
import { createMessageRepository } from '../domain/Conversation/MessageRepository.js'
import { createToolLogRepository } from '../domain/Conversation/ToolLogRepository.js'
import { deriveHookToken, resolveBoardToken } from '../technical/Auth/BoardToken.js'
import { isLocalOrigin } from '../technical/Auth/BoardOrigin.js'
import { ALLOW_REMOTE_LOCAL_ENV, assertLocalModeBinding } from '../technical/Auth/LocalBinding.js'

const PURGE_EVERY_MS = 24 * 60 * 60 * 1000

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
  const projectWorkflows = createProjectWorkflowRepository(db)
  const messages = createMessageRepository(db)
  const toolLogs = createToolLogRepository(db)
  const autopilotSettings = createAutopilotRepository(db)
  let conductor: AutopilotConductor | null = null
  const onSessionEvent = createSessionEventSink({
    sessions,
    messages,
    toolLogs,
    budget,
    live,
    events,
    onTurnEnded: (claudeSessionId) => void conductor?.turnEnded(claudeSessionId),
  })
  const templates = createTemplateRepository(db)
  const outbox = createOutboxRepository(db)
  const organisations = createOrganisationRepository(db)
  const { guardrailSeal, cwdForStory, worktrees, checkpoints, criteria, drivers, dispatcher } = createAgentRuntime({
    db,
    stories,
    sessions,
    budget,
    foremerge,
    workflow,
    workflowColumns,
    forgeCards,
    templates,
    readEvidence,
    live,
    events,
    onSessionEvent,
    testsDir,
    worktreeRoot,
  })
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
  const access = createBoardAccess({ identities, stories, mode })
  const api = createBoardApi({
    isSuperAdmin: access.isSuperAdmin,
    isDirector: access.isDirector,
    maySettleBudget: access.mayRunTheBoard,
    mayReadFleet: access.mayRunTheBoard,
    openHolds: discussion.openHolds,
    today: () => new Date().toISOString().slice(0, 10),
    zones: createZoneRepository(db),
    budget,
    repository: stories,
    agentSessions: sessions,
    checkpoints,
    criteria,
    events,
    dispatcher,
    advanceReviewCascade: (storyId) =>
      advanceCascade({
        cascade: checkpoints.reviewCascade(storyId),
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

  const guarded = createGuardedApp({ mode, token, host, port, publicOrigin, identities, stories, access })
  mountAdministrationRoutes(guarded, {
    mode,
    publicOrigin,
    setupToken,
    identities,
    stories,
    access,
    drivers,
    outbox,
    organisations,
    batches,
    templates,
    projectWorkflows,
    workflowColumns,
  })
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
      checkpoints,
      templates,
      messages,
      toolLogs,
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
  const forgeAutopilot = createForgeAutopilot({
    db,
    ticking: environmentMode === 'real' && process.env.FORGE_AUTOPILOT !== 'off',
    stories,
    sessions,
    budget,
    messages,
    foremerge,
    forgeCards,
    workflowColumns,
    autopilotSettings,
    checkpoints,
    criteria,
    worktrees,
    dispatcher,
    guardrailSeal,
    cwdForStory,
    readEvidence,
    events,
  })
  const { board: forgeBoard, closer: forgeCardCloser, mover: forgeCardMover } = forgeAutopilot
  conductor = forgeAutopilot.conductor
  guarded.route(
    '/',
    createAutopilotApi({
      autopilot: autopilotSettings,
      projectExists: (projectId) => stories.projects.find(projectId) !== null,
      mayAdminister: access.mayAdminister,
    }),
  )
  guarded.route(
    '/',
    createForgeBoardApi({
      board: forgeBoard,
      forgeCards,
      stories,
      events,
      closer: forgeCardCloser,
      mover: forgeCardMover,
      autopilot: forgeAutopilot.conductor,
    }),
  )
  const pilots = createPilotRepository(db, {
    stories,
    openDriver: (guard) => createPlaywrightPilot({ shotDir, headless: !headedPilot, guard }),
    destinations: createDestinationPolicy({
      previewPortOf: (storyId) => worktrees.findForStory(storyId)?.port ?? null,
      allowedOrigins: parseAllowedOrigins(process.env.FORGE_PILOT_ALLOWED_ORIGINS),
    }),
  })
  pilots.abandonOrphans()
  guarded.route(
    '/',
    createPilotApi({
      pilots,
      events,
      mayRun: (storyId, context) =>
        context.get('handOverride') === true ||
        stories.assigneeOf(stories.findStory(storyId).epicId) === operatorOf(context),
      suggest: (storyId) =>
        suggestParcours({
          port: worktrees.findForStory(storyId)?.port ?? null,
          criteria: criteria.listCriteria(storyId),
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
      serverPaths: mode === 'hub' ? [dbPath, tokenPath, claudeHome, process.cwd()] : [],
      installGuardrails: (checkout) => {
        const installed = installGuardrails({
          checkout,
          forgeRoot: process.cwd(),
          hook: { port, token: deriveHookToken(token) },
        })
        guardrailSeal.forget(checkout)
        return installed
      },
      mayAdminister: access.mayAdminister,
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
          Promise.resolve(forgeAutopilot.stop())
            .then(() => live.closeAll())
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
