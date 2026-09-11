import type { ScopeReservation } from './ForemergeRepository.js'
import { normalisePath } from './Scope.js'

export type WriteQuestion = {
  reservations: readonly ScopeReservation[]
  reference: string | null
  path: string
}

export type WriteDecision = {
  allowed: boolean
  reason: string | null
}

const ALLOWED: WriteDecision = { allowed: true, reason: null }

function covers(pathPrefix: string, path: string): boolean {
  return path === pathPrefix || path.startsWith(`${pathPrefix}/`)
}

export function decideOnWrite({ reservations, reference, path }: WriteQuestion): WriteDecision {
  const wanted = normalisePath(path.trim())
  if (reference === null) {
    const taken = reservations.find((reservation) => covers(reservation.pathPrefix, wanted))
    if (taken === undefined) {
      return ALLOWED
    }
    return {
      allowed: false,
      reason: `${wanted} est dans le perimetre reserve par ${taken.storyReference}, et rien ne dit qui ecrit`,
    }
  }
  const mine = reservations.filter((reservation) => reservation.storyReference === reference)
  const theirs = reservations.filter((reservation) => reservation.storyReference !== reference)

  const squatted = theirs.find((reservation) => covers(reservation.pathPrefix, wanted))
  if (squatted !== undefined) {
    return {
      allowed: false,
      reason: `${wanted} est dans le perimetre reserve par ${squatted.storyReference}`,
    }
  }
  if (mine.length === 0) {
    return ALLOWED
  }
  if (mine.some((reservation) => covers(reservation.pathPrefix, wanted))) {
    return ALLOWED
  }
  return {
    allowed: false,
    reason: `${wanted} est hors du perimetre reserve par ${reference} : ${mine
      .map((reservation) => reservation.pathPrefix)
      .join(', ')}`,
  }
}
