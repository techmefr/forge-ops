import { z } from 'zod'
import { loadDenyPatterns, matchDeniedPattern } from './DenyList.js'

const GUARDED_TOOLS: readonly string[] = ['Bash', 'PowerShell']

const payloadSchema = z.object({
  tool_name: z.string().nullish(),
  tool_input: z.object({ command: z.string().nullish() }).passthrough().nullish(),
})

export type DenyDecision = { allowed: true } | { allowed: false; reason: string }

export function decideOnHookPayload(raw: string, denyPath: string): DenyDecision {
  let content: unknown
  try {
    content = JSON.parse(raw)
  } catch {
    return { allowed: false, reason: 'Garde-fou deny : charge utile de hook illisible, commande refusee par precaution' }
  }

  const payload = payloadSchema.safeParse(content)
  if (!payload.success) {
    return { allowed: false, reason: 'Garde-fou deny : charge utile de hook illisible, commande refusee par precaution' }
  }

  if (!GUARDED_TOOLS.includes(payload.data.tool_name ?? '')) {
    return { allowed: true }
  }

  const command = payload.data.tool_input?.command
  if (command === null || command === undefined) {
    return { allowed: false, reason: 'Garde-fou deny : commande absente de la charge utile, refusee par precaution' }
  }

  let patterns: readonly string[]
  try {
    patterns = loadDenyPatterns(denyPath)
  } catch (error) {
    return {
      allowed: false,
      reason: `Garde-fou deny hors service : ${error instanceof Error ? error.message : 'cause inconnue'}`,
    }
  }

  const matched = matchDeniedPattern(command, patterns)
  if (matched !== null) {
    return { allowed: false, reason: `Commande bloquee par .claude-deny.json (pattern ${matched}) : ${command}` }
  }

  return { allowed: true }
}
