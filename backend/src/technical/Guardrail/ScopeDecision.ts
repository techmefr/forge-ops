import { relative, isAbsolute } from 'node:path'
import type { ScopeReservation } from '../../domain/Foremerge/ForemergeRepository.js'
import { decideOnWrite, type WriteDecision } from '../../domain/Foremerge/ScopeGuard.js'

export const WRITING_TOOLS: readonly string[] = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

export type ScopeQuestion = {
  reference: string | null
  read: () => readonly ScopeReservation[]
  root: string
}

const ALLOWED: WriteDecision = { allowed: true, reason: null }

function pathOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const input = (payload as Record<string, unknown>).tool_input
  if (typeof input !== 'object' || input === null) {
    return null
  }
  const file = (input as Record<string, unknown>).file_path
  return typeof file === 'string' && file.trim() !== '' ? file : null
}

function toolOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const name = (payload as Record<string, unknown>).tool_name
  return typeof name === 'string' ? name : null
}

function inside(root: string, path: string): string {
  return isAbsolute(path) ? relative(root, path) : path
}

export function decideOnScopePayload(raw: string, { reference, read, root }: ScopeQuestion): WriteDecision {
  if (reference === null) {
    return ALLOWED
  }
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return { allowed: false, reason: 'le hook de perimetre n a pas su lire ce que Claude Code lui a envoye' }
  }
  const tool = toolOf(payload)
  if (tool === null || !WRITING_TOOLS.includes(tool)) {
    return ALLOWED
  }
  const path = pathOf(payload)
  if (path === null) {
    return { allowed: false, reason: `${tool} sans chemin de fichier ne se verifie pas` }
  }
  try {
    return decideOnWrite({ reservations: read(), reference, path: inside(root, path) })
  } catch (error) {
    return {
      allowed: false,
      reason: `le perimetre de ${reference} est illisible : ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}
