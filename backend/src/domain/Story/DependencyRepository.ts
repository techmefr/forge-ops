import type Database from 'better-sqlite3'
import type { Dependency, Story } from './Story.js'
import { DependencyCycleError, SelfDependencyError } from './StoryViolation.js'

export type DependencyRepository = {
  addDependency: (dependency: Dependency) => void
  listBlockers: (storyId: number) => readonly string[]
  listFreedBy: (storyId: number) => readonly number[]
}

export function createDependencyRepository(
  db: Database.Database,
  findStory: (storyId: number) => Story,
): DependencyRepository {
  const insertDependency = db.prepare<[number, number]>(
    'INSERT OR IGNORE INTO story_dependency (blocked_story_id, blocking_story_id) VALUES (?, ?)',
  )
  const selectBlockingOf = db.prepare<[number], { blocking_story_id: number }>(
    'SELECT blocking_story_id FROM story_dependency WHERE blocked_story_id = ?',
  )
  const selectBlockedBy = db.prepare<[number], { blocked_story_id: number }>(
    'SELECT blocked_story_id FROM story_dependency WHERE blocking_story_id = ?',
  )
  const selectUnresolvedBlockers = db.prepare<[number], { reference: string }>(
    `SELECT story.reference AS reference FROM story_dependency
       JOIN story ON story.id = story_dependency.blocking_story_id
      WHERE story_dependency.blocked_story_id = ?
        AND story.state <> 'done'
      ORDER BY story.reference`,
  )

  function pathToward(fromStoryId: number, targetStoryId: number): number[] | null {
    const seen = new Set<number>()
    const walk = (current: number, trail: number[]): number[] | null => {
      if (current === targetStoryId) {
        return trail
      }
      if (seen.has(current)) {
        return null
      }
      seen.add(current)
      for (const row of selectBlockingOf.all(current)) {
        const found = walk(row.blocking_story_id, [...trail, row.blocking_story_id])
        if (found !== null) {
          return found
        }
      }
      return null
    }
    return walk(fromStoryId, [])
  }

  function listBlockers(storyId: number): readonly string[] {
    return selectUnresolvedBlockers.all(storyId).map((row) => row.reference)
  }

  return {
    addDependency: (dependency) => {
      const blocked = findStory(dependency.blockedStoryId)
      if (dependency.blockedStoryId === dependency.blockingStoryId) {
        throw new SelfDependencyError(blocked.reference)
      }
      const blocking = findStory(dependency.blockingStoryId)
      const loop = pathToward(dependency.blockingStoryId, dependency.blockedStoryId)
      if (loop !== null) {
        throw new DependencyCycleError(
          blocking.reference,
          loop.map((storyId) => findStory(storyId).reference),
        )
      }
      insertDependency.run(dependency.blockedStoryId, dependency.blockingStoryId)
    },

    listBlockers,

    listFreedBy: (storyId) =>
      selectBlockedBy
        .all(storyId)
        .map((row) => row.blocked_story_id)
        .filter((blockedId) => listBlockers(blockedId).length === 0),
  }
}
