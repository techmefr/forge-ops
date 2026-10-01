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

export const EVIDENCE_FOLDER = '.claude/evidence/'

export const EVIDENCE_WRITING_PHASES: readonly AgentPhase[] = ['spec', 'architecture']

export const EVIDENCE_WRITE_TOOLS: readonly string[] = ['Write', 'Edit', 'MultiEdit']

function declared(phase: string): phase is AgentPhase {
  return Object.prototype.hasOwnProperty.call(PHASE_TOOL_POLICY, phase)
}

export function toolsOfPhase(phase: string): readonly string[] {
  if (!declared(phase)) {
    throw new UnknownPhaseError(phase)
  }
  return PHASE_TOOL_POLICY[phase]
}

export function writesEvidenceOnly(phase: string, tool: string): boolean {
  return (EVIDENCE_WRITING_PHASES as readonly string[]).includes(phase) && EVIDENCE_WRITE_TOOLS.includes(tool)
}

export function allowsTool(phase: string, tool: string): boolean {
  if (!declared(phase)) {
    return false
  }
  return PHASE_TOOL_POLICY[phase].includes(tool)
}

export function isWritingTool(tool: string): boolean {
  return (WRITE_TOOLS as readonly string[]).includes(tool)
}

export function isShellTool(tool: string): boolean {
  return (SHELL_TOOLS as readonly string[]).includes(tool)
}
