import type { AgentDriver } from '../domain/Driver/Driver.js'
import type { BoardEvent } from '../technical/Http/EventBus.js'
import { createSdkSessionRunner } from '../technical/ClaudeCode/SdkSessionRunner.js'
import type { LiveSessions } from '../technical/ClaudeCode/LiveSessions.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import { createCodexSessionRunner } from '../technical/Codex/CodexSessionRunner.js'
import { createCodexTranscriptStore } from '../technical/Codex/CodexTranscriptStore.js'
import { AGENT_MANIFESTS } from '../technical/Cli/AgentManifests.js'
import { createCliSessionRunner } from '../technical/Cli/CliSessionRunner.js'
import type { GuardrailSeal } from '../technical/Guardrail/GuardrailSeal.js'
import { DEFAULT_PUSH_REMOTE } from '../technical/Guardrail/ShellPolicy.js'
import { projectTestCommand } from '../technical/Gate/ProjectTestCommand.js'
import { claudeCodeDriver } from './ClaudeCodeDriver.js'
import { codexDriver } from './CodexDriver.js'
import { cliDriver } from './CliDriver.js'

export type AgentDriversInput = {
  cwdForStory: (storyId: number) => string
  branchOfStory: (storyId: number) => string | null
  live: LiveSessions<SdkUserTurn>
  seal: GuardrailSeal
  onEvent: (event: BoardEvent) => void
}

export function createAgentDrivers({
  cwdForStory,
  branchOfStory,
  live,
  seal,
  onEvent,
}: AgentDriversInput): readonly AgentDriver[] {
  const transcripts = createCodexTranscriptStore()
  const cwdFor = (order: { storyId: number }): string => cwdForStory(order.storyId)

  return [
    claudeCodeDriver(
      createSdkSessionRunner({
        cwdFor,
        live,
        onEvent,
        forgeRoot: process.cwd(),
        seal,
        shellSeedFor: (order) => {
          const declared = projectTestCommand(cwdForStory(order.storyId))
          return {
            branch: branchOfStory(order.storyId),
            remote: process.env.FORGE_PUSH_REMOTE?.trim() || DEFAULT_PUSH_REMOTE,
            testCommands: declared === null ? [] : [declared],
          }
        },
      }),
    ),
    codexDriver(createCodexSessionRunner({ cwdFor, onEvent, transcripts })),
    ...AGENT_MANIFESTS.map((manifest) =>
      cliDriver(manifest, createCliSessionRunner({ manifest, cwdFor, onEvent, transcripts })),
    ),
  ]
}
