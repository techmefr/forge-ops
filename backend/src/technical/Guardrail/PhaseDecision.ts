import { z } from 'zod'
import { decideOnHookPayload } from './DenyDecision.js'
import { allowsTool, toolsOfPhase } from './PhaseToolPolicy.js'

const payloadSchema = z.object({
  tool_name: z.string().min(1),
})

export type PhaseDecision = { allowed: true } | { allowed: false; reason: string }

export type ToolCallQuestion = {
  denyPath: string
  phase: string | null
}

const ALLOWED: PhaseDecision = { allowed: true }

function refused(reason: string): PhaseDecision {
  return { allowed: false, reason: `Garde-fou de phase : ${reason}, refuse par precaution` }
}

export function decideOnPhasePayload(raw: string, phase: string | null): PhaseDecision {
  if (phase === null || phase.trim() === '') {
    return refused('aucune phase declaree pour cette session')
  }

  let tools: readonly string[]
  try {
    tools = toolsOfPhase(phase)
  } catch {
    return refused(`phase inconnue ${phase}`)
  }

  let content: unknown
  try {
    content = JSON.parse(raw)
  } catch {
    return refused('charge utile de hook illisible')
  }

  const payload = payloadSchema.safeParse(content)
  if (!payload.success) {
    return refused('charge utile de hook sans nom d outil')
  }

  const tool = payload.data.tool_name
  if (!allowsTool(phase, tool)) {
    return {
      allowed: false,
      reason: `Outil ${tool} interdit en phase ${phase} : cette phase n autorise que ${tools.join(', ')}`,
    }
  }

  return ALLOWED
}

export function decideOnToolCall(raw: string, { denyPath, phase }: ToolCallQuestion): PhaseDecision {
  const byPhase = decideOnPhasePayload(raw, phase)
  if (!byPhase.allowed) {
    return byPhase
  }
  return decideOnHookPayload(raw, denyPath)
}
