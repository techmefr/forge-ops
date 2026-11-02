import type { Hono } from 'hono'
import { createAutopilotApi } from '../domain/Autopilot/AutopilotApi.js'
import { createBoardApi } from '../domain/Board/BoardApi.js'
import { advanceCascade } from '../domain/Checkpoint/ReviewCascade.js'
import { createConversationApi } from '../domain/Conversation/ConversationApi.js'
import { cleanUpAfterMerge } from '../domain/Deployment/MergeCleanup.js'
import { createDiscussionApi } from '../domain/Discussion/DiscussionApi.js'
import { createFileApi } from '../domain/File/FileApi.js'
import { createFileRepository } from '../domain/File/FileRepository.js'
import { createForemergeApi } from '../domain/Foremerge/ForemergeApi.js'
import { createForgeBoardApi } from '../domain/ForgeCard/ForgeBoardApi.js'
import { createForgeCardApi } from '../domain/ForgeCard/ForgeCardApi.js'
import { createIncidentApi } from '../domain/Incident/IncidentApi.js'
import { createIncidentRepository } from '../domain/Incident/IncidentRepository.js'
import { createMachineApi } from '../domain/Resource/MachineApi.js'
import { createPilotApi } from '../domain/Pilot/PilotApi.js'
import { createDestinationPolicy, parseAllowedOrigins } from '../domain/Pilot/PilotDestination.js'
import { createPilotRepository } from '../domain/Pilot/PilotRepository.js'
import { suggestParcours } from '../domain/Pilot/Parcours.js'
import { createPreferenceApi } from '../domain/Preference/PreferenceApi.js'
import { createPreferenceRepository } from '../domain/Preference/PreferenceRepository.js'
import { createStatisticApi } from '../domain/Statistic/StatisticApi.js'
import { createStatisticRepository } from '../domain/Statistic/StatisticRepository.js'
import { createWorktreeApi } from '../domain/Worktree/WorktreeApi.js'
import { createZoneRepository } from '../domain/Zone/ZoneRepository.js'
import { operatorOf } from '../technical/Auth/BoardIdentity.js'
import { deriveHookToken } from '../technical/Auth/BoardToken.js'
import { createPlaywrightPilot } from '../technical/Browser/PlaywrightPilot.js'
import { createSdkSessionTalker } from '../technical/ClaudeCode/SdkSessionRunner.js'
import { installGuardrails } from '../technical/Guardrail/GuardrailInstall.js'
import { createPilotShotApi } from '../technical/Http/PilotShotApi.js'
import { sessionCap } from './AgentRuntime.js'
import type { BoardCore } from './BoardCore.js'
import type { BoardServerInput } from './BoardServerInput.js'
import type { ForgeAutopilot } from './ForgeAutopilot.js'

export function createBoardApiOf(core: BoardCore, { claudeHome }: Pick<BoardServerInput, 'claudeHome'>) {
  const { access, discussion, stories, sessions, budget, checkpoints, criteria, events, dispatcher, foremerge, worktrees } = core
  return createBoardApi({
    isSuperAdmin: access.isSuperAdmin,
    isDirector: access.isDirector,
    maySettleBudget: access.mayRunTheBoard,
    mayReadFleet: access.mayRunTheBoard,
    openHolds: discussion.openHolds,
    today: () => new Date().toISOString().slice(0, 10),
    zones: createZoneRepository(core.db),
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
}

export function mountConversationRoutes(guarded: Hono, core: BoardCore): void {
  const { stories, sessions, events, live, onSessionEvent, discussion, checkpoints, templates, messages, toolLogs } = core
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
  guarded.route('/', createDiscussionApi({ stories, discussion, events }))
  guarded.route('/', createForemergeApi({ foremerge: core.foremerge, events }))
  guarded.route('/', createWorktreeApi({ worktrees: core.worktrees, stories, events }))
  guarded.route('/', createForgeCardApi({ forgeCards: core.forgeCards, worktrees: core.worktrees, stories }))
}

export function mountFlowRoutes(guarded: Hono, core: BoardCore, forgeAutopilot: ForgeAutopilot): void {
  const { stories, forgeCards, events, access } = core
  guarded.route(
    '/',
    createAutopilotApi({
      autopilot: core.autopilotSettings,
      projectExists: (projectId) => stories.projects.find(projectId) !== null,
      mayAdminister: access.mayAdminister,
    }),
  )
  guarded.route(
    '/',
    createForgeBoardApi({
      board: forgeAutopilot.board,
      forgeCards,
      stories,
      events,
      closer: forgeAutopilot.closer,
      mover: forgeAutopilot.mover,
      autopilot: forgeAutopilot.conductor,
    }),
  )
}

export function mountPilotRoutes(
  guarded: Hono,
  core: BoardCore,
  { shotDir, headedPilot }: Pick<BoardServerInput, 'shotDir' | 'headedPilot'>,
) {
  const { stories, worktrees, criteria, events } = core
  const pilots = createPilotRepository(core.db, {
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
  return pilots
}

export function mountSupportRoutes(
  guarded: Hono,
  core: BoardCore,
  { port, dbPath, tokenPath, claudeHome, mode, metricsUrl }: Pick<
    BoardServerInput,
    'port' | 'dbPath' | 'tokenPath' | 'claudeHome' | 'mode' | 'metricsUrl'
  >,
): void {
  const { db, stories, identities, dispatcher, guardrailSeal, access } = core
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
      checkoutRoots: core.allowedCheckoutRoots,
      serverPaths: mode === 'hub' ? [dbPath, tokenPath, claudeHome, process.cwd()] : [],
      installGuardrails: (checkout) => {
        const installed = installGuardrails({
          checkout,
          forgeRoot: process.cwd(),
          hook: { port, token: deriveHookToken(core.token) },
        })
        guardrailSeal.forget(checkout)
        return installed
      },
      mayAdminister: access.mayAdminister,
    }),
  )
  guarded.route('/', createStatisticApi({ statistics: createStatisticRepository(db) }))
  guarded.route('/', createIncidentApi({ incidents: createIncidentRepository(db, { stories }), events: core.events }))
}
