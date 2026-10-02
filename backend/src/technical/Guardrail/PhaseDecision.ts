import { isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'
import { decideOnHookPayload } from './DenyDecision.js'
import { decideShellCommand, shellContextOf, shellSeedOf } from './ShellPolicy.js'
import { allowsTool, EVIDENCE_FOLDER, toolsOfPhase, writesEvidenceOnly } from './PhaseToolPolicy.js'

const payloadSchema = z.object({
  tool_name: z.string().min(1),
  tool_input: z.object({ file_path: z.string().optional() }).passthrough().optional(),
})

function insideEvidence(root: string, file: string | undefined): boolean {
  if (file === undefined || file.trim() === '') {
    return false
  }
  const walked = relative(resolve(root, EVIDENCE_FOLDER), resolve(root, file))
  return walked !== '' && !walked.startsWith('..') && !isAbsolute(walked)
}

export type PhaseDecision = { allowed: true } | { allowed: false; reason: string }

export type ToolCallQuestion = {
  denyPath: string
  phase: string | null
  root?: string
  env?: NodeJS.ProcessEnv
}

const ALLOWED: PhaseDecision = { allowed: true }

function refused(reason: string): PhaseDecision {
  return { allowed: false, reason: `Garde-fou de phase : ${reason}, refuse par precaution` }
}

export function decideOnPhasePayload(
  raw: string,
  phase: string | null,
  root: string = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
): PhaseDecision {
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
  if (writesEvidenceOnly(phase, tool)) {
    if (insideEvidence(root, payload.data.tool_input?.file_path)) {
      return ALLOWED
    }
    return refused(`outil ${tool} limite a ${EVIDENCE_FOLDER} en phase ${phase}`)
  }

  if (!allowsTool(phase, tool)) {
    return {
      allowed: false,
      reason: `Outil ${tool} interdit en phase ${phase} : cette phase n autorise que ${tools.join(', ')}`,
    }
  }

  return ALLOWED
}

function shellCommandOf(raw: string): { command: unknown } | null {
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || !['Bash', 'PowerShell'].includes(parsed.data.tool_name)) {
      return null
    }
    const input: Record<string, unknown> = parsed.data.tool_input ?? {}
    return { command: parsed.data.tool_name === 'Bash' ? input.command : undefined }
  } catch {
    return null
  }
}

export function decideOnToolCall(
  raw: string,
  { denyPath, phase, root, env = process.env }: ToolCallQuestion,
): PhaseDecision {
  const byPhase = decideOnPhasePayload(raw, phase, root)
  if (!byPhase.allowed) {
    return byPhase
  }
  const byDenyList = decideOnHookPayload(raw, denyPath)
  if (!byDenyList.allowed) {
    return byDenyList
  }
  const shell = shellCommandOf(raw)
  if (shell === null) {
    return ALLOWED
  }
  if (typeof shell.command !== 'string' || phase === null) {
    return refused('commande shell sans texte simple')
  }
  const decision = decideShellCommand(
    shell.command,
    shellContextOf(phase, root ?? env.CLAUDE_PROJECT_DIR ?? process.cwd(), shellSeedOf(env)),
  )
  return decision.allowed ? ALLOWED : { allowed: false, reason: decision.reason }
}
