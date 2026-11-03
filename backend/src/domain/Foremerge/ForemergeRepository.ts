import type Database from 'better-sqlite3'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { BlankScopeError, ScopeNotWrittenError, ScopeTakenError } from './ForemergeViolation.js'
import { prepareForemergeStatements, type ReservationRow } from './ForemergeStatements.js'
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
  const { selectLive, insertReservation, clearRelease, expireLapsed, renewHeld, releaseAll, selectOne } =
    prepareForemergeStatements(db)

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
