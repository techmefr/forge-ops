import type Database from 'better-sqlite3'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { BlankScopeError, ScopeNotWrittenError, ScopeTakenError } from './ForemergeViolation.js'
import {
  collisionsBetween,
  LEASE_MINUTES,
  normalisePath,
  type ScopeClaim,
  type ScopeCollision,
} from './Scope.js'

export type { ScopeReservation } from '../../../../contract/WorkspaceContract.js'

import type { ScopeReservation } from '../../../../contract/WorkspaceContract.js'

export type ForemergeRepository = {
  reserve: (claim: ScopeClaim) => ScopeReservation
  renew: (storyId: number) => number
  release: (storyId: number) => number
  listReservations: () => readonly ScopeReservation[]
  collisions: () => readonly ScopeCollision[]
}

export type ForemergeRepositoryInput = {
  stories: StoryRepository
}

type ReservationRow = {
  id: number
  story_id: number
  reference: string
  path_prefix: string
  symbols: string
  reserved_at: string
}

const SEPARATOR = ','

const LEASE_ELAPSED = `-${LEASE_MINUTES} minutes`

const LEASE_SPAN = `+${LEASE_MINUTES} minutes`

function splitSymbols(stored: string): readonly string[] {
  return stored
    .split(SEPARATOR)
    .map((symbol) => symbol.trim())
    .filter((symbol) => symbol !== '')
}

export function createForemergeRepository(
  db: Database.Database,
  { stories }: ForemergeRepositoryInput,
): ForemergeRepository {
  const selectLive = db.prepare<[], ReservationRow>(`
    SELECT reservation.id, reservation.story_id, story.reference, reservation.path_prefix,
           reservation.symbols, reservation.reserved_at
    FROM scope_reservation AS reservation
    JOIN story ON story.id = reservation.story_id
    WHERE reservation.released_at IS NULL
    ORDER BY reservation.id ASC
  `)

  const insertReservation = db.prepare<[number, string, string]>(
    'INSERT INTO scope_reservation (story_id, path_prefix, symbols, renewed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
  )

  const clearRelease = db.prepare<[number, string]>(`
    UPDATE scope_reservation
    SET reserved_at = CASE WHEN released_at IS NULL THEN reserved_at ELSE CURRENT_TIMESTAMP END,
        renewed_at = CURRENT_TIMESTAMP,
        released_at = NULL
    WHERE story_id = ? AND path_prefix = ?
  `)

  const expireLapsed = db.prepare<[string, string]>(`
    UPDATE scope_reservation
    SET released_at = datetime(COALESCE(renewed_at, reserved_at), ?)
    WHERE released_at IS NULL AND COALESCE(renewed_at, reserved_at) <= datetime('now', ?)
  `)

  const renewHeld = db.prepare<[number]>(
    'UPDATE scope_reservation SET renewed_at = CURRENT_TIMESTAMP WHERE story_id = ? AND released_at IS NULL',
  )

  const releaseAll = db.prepare<[number]>(
    "UPDATE scope_reservation SET released_at = datetime('now') WHERE story_id = ? AND released_at IS NULL",
  )

  const selectOne = db.prepare<[number, string], ReservationRow>(`
    SELECT reservation.id, reservation.story_id, story.reference, reservation.path_prefix,
           reservation.symbols, reservation.reserved_at
    FROM scope_reservation AS reservation
    JOIN story ON story.id = reservation.story_id
    WHERE reservation.story_id = ? AND reservation.path_prefix = ?
  `)

  function toReservation(row: ReservationRow): ScopeReservation {
    return {
      id: row.id,
      storyId: row.story_id,
      storyReference: row.reference,
      pathPrefix: row.path_prefix,
      symbols: splitSymbols(row.symbols),
      reservedAt: row.reserved_at,
    }
  }

  function live(): readonly ScopeReservation[] {
    expireLapsed.run(LEASE_SPAN, LEASE_ELAPSED)
    return selectLive.all().map(toReservation)
  }

  return {
    reserve: (claim) => {
      const story = stories.findStory(claim.storyId)
      const pathPrefix = normalisePath(claim.pathPrefix.trim())
      if (pathPrefix === '') {
        throw new BlankScopeError()
      }
      const wanted: ScopeClaim = { storyId: claim.storyId, pathPrefix, symbols: claim.symbols }
      for (const held of live()) {
        const collision = collisionsBetween([held, wanted])[0]
        if (collision !== undefined) {
          throw new ScopeTakenError(pathPrefix, held.storyReference, held.reservedAt, collision.reason)
        }
      }
      if (selectOne.get(claim.storyId, pathPrefix) === undefined) {
        insertReservation.run(claim.storyId, pathPrefix, claim.symbols.join(SEPARATOR))
      } else {
        clearRelease.run(claim.storyId, pathPrefix)
      }
      const written = selectOne.get(claim.storyId, pathPrefix)
      if (written === undefined) {
        throw new ScopeNotWrittenError(pathPrefix)
      }
      return { ...toReservation(written), storyReference: story.reference }
    },

    renew: (storyId) => {
      expireLapsed.run(LEASE_SPAN, LEASE_ELAPSED)
      return renewHeld.run(storyId).changes
    },

    release: (storyId) => releaseAll.run(storyId).changes,

    listReservations: live,

    collisions: () => collisionsBetween(live()),
  }
}
