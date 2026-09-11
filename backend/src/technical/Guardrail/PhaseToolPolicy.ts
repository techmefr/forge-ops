import type { AgentPhase } from '../../domain/Agent/AgentSession.js'
import { READ_TOOLS, SHELL_TOOLS, WRITE_TOOLS } from '../../domain/Agent/ToolName.js'
import { UnknownPhaseError } from './GuardrailViolation.js'

export const PHASE_TOOL_POLICY: Readonly<Record<AgentPhase, readonly string[]>> = {
  spec: READ_TOOLS,
  architecture: READ_TOOLS,
  tdd: [...READ_TOOLS, ...WRITE_TOOLS, ...SHELL_TOOLS],
  code: [...READ_TOOLS, ...WRITE_TOOLS, ...SHELL_TOOLS],
  gate: [...READ_TOOLS, ...SHELL_TOOLS],
  review: [...READ_TOOLS, ...SHELL_TOOLS],
  ship: [...READ_TOOLS, ...SHELL_TOOLS],
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
