import type { AgentPhase } from '../../domain/Agent/AgentSession.js'
import { UnknownPhaseError } from './GuardrailViolation.js'

const READING_TOOLS: readonly string[] = [
  'Read',
  'Grep',
  'Glob',
  'LS',
  'TodoWrite',
  'WebFetch',
  'WebSearch',
  'Task',
]

const WRITING_TOOLS: readonly string[] = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell']

export const PHASE_TOOL_POLICY: Readonly<Record<AgentPhase, readonly string[]>> = {
  spec: READING_TOOLS,
  architecture: READING_TOOLS,
  tdd: [...READING_TOOLS, ...WRITING_TOOLS, ...SHELL_TOOLS],
  code: [...READING_TOOLS, ...WRITING_TOOLS, ...SHELL_TOOLS],
  gate: [...READING_TOOLS, ...SHELL_TOOLS],
  review: [...READING_TOOLS, ...SHELL_TOOLS],
  ship: [...READING_TOOLS, ...SHELL_TOOLS],
}

function declared(phase: string): phase is AgentPhase {
  return Object.prototype.hasOwnProperty.call(PHASE_TOOL_POLICY, phase)
}

export function toolsOfPhase(phase: string): readonly string[] {
  if (!declared(phase)) {
    throw new UnknownPhaseError(phase)
  }
  return PHASE_TOOL_POLICY[phase]
}

export function allowsTool(phase: string, tool: string): boolean {
  if (!declared(phase)) {
    return false
  }
  return PHASE_TOOL_POLICY[phase].includes(tool)
}
