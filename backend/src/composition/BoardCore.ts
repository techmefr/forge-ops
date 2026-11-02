import { join, resolve } from 'node:path'
import type { AutopilotConductor } from '../domain/Autopilot/AutopilotConductor.js'
import type { IdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { readSuperAdminConfiguration } from '../technical/Auth/SuperAdminConfiguration.js'
import { resolveBoardToken } from '../technical/Auth/BoardToken.js'
import { ALLOW_REMOTE_LOCAL_ENV, assertLocalModeBinding } from '../technical/Auth/LocalBinding.js'
import { openDatabase } from '../technical/Database/Connection.js'
import { createEvidenceFileReader } from '../technical/Evidence/EvidenceFileReader.js'
import { createLiveSessions } from '../technical/ClaudeCode/LiveSessions.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import { createEventBus } from '../technical/Http/EventBus.js'
import { createAgentRuntime } from './AgentRuntime.js'
import { createBoardAccess } from './BoardAccess.js'
import { createBoardRepositories } from './BoardRepositories.js'
import type { BoardMode, BoardServerInput } from './BoardServerInput.js'
import { createSessionEventSink } from './SessionEventSink.js'

export type BoardCore = ReturnType<typeof createBoardCore>

type BoardCoreInput = Pick<
  BoardServerInput,
  'dbPath' | 'tokenPath' | 'checkoutRoots' | 'worktreeRoot' | 'testsDir' | 'mode' | 'host'
>

function seedSuperAdmin(identities: IdentityRepository, mode: BoardMode): void {
  const seed = readSuperAdminConfiguration(process.env, undefined, (message) => console.warn(message))
  if (seed !== null) {
    identities.bootstrapSuperAdmin(seed)
  } else if (mode === 'hub') {
    console.warn(
      'No super admin configured: set FORGE_SUPER_ADMIN_LOGIN and FORGE_SUPER_ADMIN_PASSWORD (or FORGE_SUPER_ADMIN_PASSWORD_FILE); nobody can manage super admins and first enrolment stays closed until then (or set FORGE_SETUP_TOKEN).',
    )
  }
}

export function createBoardCore({ dbPath, tokenPath, checkoutRoots, worktreeRoot, testsDir, mode, host }: BoardCoreInput) {
  assertLocalModeBinding(mode, host, process.env[ALLOW_REMOTE_LOCAL_ENV])
  const db = openDatabase(dbPath)
  const token = resolveBoardToken(tokenPath)
  const events = createEventBus()
  const allowedCheckoutRoots = [...checkoutRoots, resolve(worktreeRoot)]
  const repositories = createBoardRepositories(db, allowedCheckoutRoots)
  const { stories, sessions, budget, messages, toolLogs, foremerge, workflow, workflowColumns, forgeCards, templates } =
    repositories
  const readEvidence = createEvidenceFileReader({ root: process.cwd(), evidenceRoot: join('.claude', 'evidence') })
  const live = createLiveSessions<SdkUserTurn>()
  const conductorHolder: { current: AutopilotConductor | null } = { current: null }
  const onSessionEvent = createSessionEventSink({
    sessions,
    messages,
    toolLogs,
    budget,
    live,
    events,
    onTurnEnded: (claudeSessionId) => void conductorHolder.current?.turnEnded(claudeSessionId),
  })
  const runtime = createAgentRuntime({
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
  seedSuperAdmin(repositories.identities, mode)
  const access = createBoardAccess({ identities: repositories.identities, stories, mode })
  return { db, token, events, live, readEvidence, allowedCheckoutRoots, onSessionEvent, conductorHolder, access, ...repositories, ...runtime }
}
