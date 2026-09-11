import { relative, isAbsolute, resolve } from 'node:path'
import type { ScopeReservation } from '../../domain/Foremerge/ForemergeRepository.js'
import { decideOnWrite, type WriteDecision } from '../../domain/Foremerge/ScopeGuard.js'
import { isWriteTool, WRITE_TOOLS } from '../../domain/Agent/ToolName.js'
import { decideOnPhasePayload } from './PhaseDecision.js'

export const WRITING_TOOLS: readonly string[] = WRITE_TOOLS

export type ScopeQuestion = {
  reference: string | null
  read: () => readonly ScopeReservation[]
  renew?: (storyId: number) => void
  root: string
}

export type WriteToolCallQuestion = ScopeQuestion & {
  phase: string | null
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

function inside(root: string, path: string): string | null {
  const walked = relative(resolve(root), resolve(root, path))
  if (walked === '' || walked.startsWith('..') || isAbsolute(walked)) {
    return null
  }
  return walked
}

function renewLease(
  reservations: readonly ScopeReservation[],
  reference: string,
  renew: ((storyId: number) => void) | undefined,
): void {
  if (renew === undefined) {
    return
  }
  const mine = reservations.find((reservation) => reservation.storyReference === reference)
  if (mine !== undefined) {
    renew(mine.storyId)
  }
}

export function decideOnScopePayload(
  raw: string,
  { reference, read, renew, root }: ScopeQuestion,
): WriteDecision {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    if (reference === null) {
      return ALLOWED
    }
    return { allowed: false, reason: 'le hook de perimetre n a pas su lire ce que Claude Code lui a envoye' }
  }
  const tool = toolOf(payload)
  if (tool === null || !isWriteTool(tool)) {
    return ALLOWED
  }
  const path = pathOf(payload)
  if (path === null) {
    return { allowed: false, reason: `${tool} sans chemin de fichier ne se verifie pas` }
  }
  const wanted = inside(root, path)
  if (wanted === null) {
    return { allowed: false, reason: `${path} est hors du depot, ce hook ne laisse rien sortir du perimetre` }
  }
  try {
    const reservations = read()
    if (reference !== null) {
      renewLease(reservations, reference, renew)
    }
    return decideOnWrite({ reservations, reference, path: wanted })
  } catch (error) {
    return {
      allowed: false,
      reason: `le perimetre reserve est illisible : ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}

export function decideOnWriteToolCall(raw: string, { phase, ...question }: WriteToolCallQuestion): WriteDecision {
  const byPhase = decideOnPhasePayload(raw, phase)
  if (!byPhase.allowed) {
    return { allowed: false, reason: byPhase.reason }
  }
  return decideOnScopePayload(raw, question)
}
