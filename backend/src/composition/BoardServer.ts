import { serve } from '@hono/node-server'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createBoardPage } from '../technical/Http/BoardPage.js'
import { isLocalOrigin } from '../technical/Auth/BoardOrigin.js'
import { mountAdministrationRoutes } from './AdministrationRoutes.js'
import { createBoardCore, type BoardCore } from './BoardCore.js'
import {
  createBoardApiOf,
  mountConversationRoutes,
  mountFlowRoutes,
  mountPilotRoutes,
  mountSupportRoutes,
} from './BoardRoutes.js'
import type { BoardServer, BoardServerInput, EnvironmentMode } from './BoardServerInput.js'
import { createForgeAutopilot } from './ForgeAutopilot.js'
import { createGuardedApp } from './GuardedApp.js'

export type { BoardMode, BoardServer, BoardServerInput, EnvironmentMode } from './BoardServerInput.js'

const LOOPBACK = '127.0.0.1'

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

function startForgeAutopilot(core: BoardCore, environmentMode: EnvironmentMode) {
  const forgeAutopilot = createForgeAutopilot({
    db: core.db,
    ticking: environmentMode === 'real' && process.env.FORGE_AUTOPILOT !== 'off',
    stories: core.stories,
    sessions: core.sessions,
    budget: core.budget,
    messages: core.messages,
    foremerge: core.foremerge,
    forgeCards: core.forgeCards,
    workflowColumns: core.workflowColumns,
    autopilotSettings: core.autopilotSettings,
    checkpoints: core.checkpoints,
    criteria: core.criteria,
    worktrees: core.worktrees,
    dispatcher: core.dispatcher,
    guardrailSeal: core.guardrailSeal,
    cwdForStory: core.cwdForStory,
    readEvidence: core.readEvidence,
    events: core.events,
  })
  core.conductorHolder.current = forgeAutopilot.conductor
  return forgeAutopilot
}

function listen(
  guarded: ReturnType<typeof createGuardedApp>,
  { port, host }: Pick<BoardServerInput, 'port' | 'host'>,
  { before, after }: { before: () => Promise<unknown>; after: () => void },
): Promise<BoardServer> {
  return new Promise((resolveServer) => {
    const server = serve({ fetch: guarded.fetch, port, hostname: host }, (address) => {
      resolveServer({
        server,
        port: address.port,
        close: () =>
          before().then(
            () =>
              new Promise<void>((closed) => {
                server.close(() => {
                  after()
                  closed()
                })
              }),
          ),
      })
    })
  })
}

export function startBoardServer(input: BoardServerInput): Promise<BoardServer> {
  const { mode, host, port, publicOrigin, distDir, environmentMode } = input
  const core = createBoardCore(input)
  const { identities, stories, access } = core
  const guarded = createGuardedApp({ mode, token: core.token, host, port, publicOrigin, identities, stories, access })
  mountAdministrationRoutes(guarded, {
    mode,
    publicOrigin,
    setupToken: process.env.FORGE_SETUP_TOKEN?.trim() || null,
    identities,
    stories,
    access,
    drivers: core.drivers,
    outbox: core.outbox,
    organisations: core.organisations,
    batches: core.batches,
    templates: core.templates,
    projectWorkflows: core.projectWorkflows,
    workflowColumns: core.workflowColumns,
  })
  guarded.get('/api/board/mode', (context) =>
    context.json({
      mode,
      environment: environmentMode,
      localTrusted: mode === 'local' && isLocalOrigin(context.req.header('origin'), host, port),
    }),
  )
  mountConversationRoutes(guarded, core)
  const forgeAutopilot = startForgeAutopilot(core, environmentMode)
  mountFlowRoutes(guarded, core, forgeAutopilot)
  const pilots = mountPilotRoutes(guarded, core, input)
  mountSupportRoutes(guarded, core, input)
  guarded.route('/', createBoardApiOf(core, input))
  guarded.route('/', createBoardPage({ distDir }))
  return listen(guarded, input, {
    before: () =>
      Promise.resolve(forgeAutopilot.stop())
        .then(() => core.live.closeAll())
        .then(() => pilots.closeBrowsers()),
    after: () => core.db.close(),
  })
}
