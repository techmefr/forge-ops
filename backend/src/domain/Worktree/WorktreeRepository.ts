import type Database from 'better-sqlite3'
import { join } from 'node:path'
import { allocatePort, DEFAULT_BASE_PORT, DEFAULT_PORT_RANGE } from '../../technical/Network/PortAllocator.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { branchNameFor, worktreeFolderFor } from './Branch.js'
import type { GitWorktreeRunner, Worktree, WorktreeOrder } from './Worktree.js'
import {
  WorktreeAlreadyLiveError,
  WorktreeNotFoundError,
  WorktreeNotRemovableError,
} from './WorktreeViolation.js'

export type WorktreeRepository = {
  open: (order: WorktreeOrder) => Worktree
  close: (storyId: number, options?: { force?: boolean; deleteBranch?: boolean }) => void
  findForStory: (storyId: number) => Worktree | null
  listLive: () => readonly Worktree[]
}

export type WorktreeRepositoryInput = {
  stories: StoryRepository
  git: GitWorktreeRunner
  root: string
  isPortFree: (port: number) => boolean
}

type WorktreeRow = {
  id: number
  story_id: number
  reference: string
  path: string
  branch: string
  base_ref: string
  base_sha: string
  port: number
  subdomain: string
  created_at: string
}

const LIVE_SELECTION = `
  SELECT worktree.id, worktree.story_id, story.reference, worktree.path, worktree.branch,
         worktree.base_ref, worktree.base_sha, reservation.port, reservation.subdomain,
         worktree.created_at
  FROM worktree
  JOIN story ON story.id = worktree.story_id
  JOIN port_reservation AS reservation ON reservation.worktree_id = worktree.id
  WHERE worktree.removed_at IS NULL AND reservation.released_at IS NULL
`

export function createWorktreeRepository(
  db: Database.Database,
  { stories, git, root, isPortFree }: WorktreeRepositoryInput,
): WorktreeRepository {
  const selectLive = db.prepare<[], WorktreeRow>(`${LIVE_SELECTION} ORDER BY worktree.id ASC`)

  const selectLiveForStory = db.prepare<[number], WorktreeRow>(
    `${LIVE_SELECTION} AND worktree.story_id = ?`,
  )

  const selectRowForStory = db.prepare<[number], { id: number; path: string }>(
    'SELECT id, path FROM worktree WHERE story_id = ?',
  )

  const insertWorktree = db.prepare<[number, string, string, string, string]>(
    'INSERT INTO worktree (story_id, path, branch, base_ref, base_sha) VALUES (?, ?, ?, ?, ?)',
  )

  const reopenWorktree = db.prepare<[string, string, string, number]>(
    'UPDATE worktree SET removed_at = NULL, path = ?, branch = ?, base_sha = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
  )

  const takenPort = db.prepare<[number], { port: number }>(
    'SELECT port FROM port_reservation WHERE port = ? AND released_at IS NULL',
  )

  const previousPort = db.prepare<[number], { port: number }>(
    'SELECT port FROM port_reservation WHERE worktree_id = ?',
  )

  const dropReservation = db.prepare<[number]>('DELETE FROM port_reservation WHERE worktree_id = ?')

  const insertReservation = db.prepare<[number, number, string]>(
    'INSERT INTO port_reservation (port, worktree_id, subdomain) VALUES (?, ?, ?)',
  )

  const releaseReservation = db.prepare<[number]>(
    "UPDATE port_reservation SET released_at = datetime('now') WHERE worktree_id = ? AND released_at IS NULL",
  )

  const markRemoved = db.prepare<[number]>(
    "UPDATE worktree SET removed_at = datetime('now') WHERE id = ?",
  )

  function toWorktree(row: WorktreeRow): Worktree {
    return {
      id: row.id,
      storyId: row.story_id,
      storyReference: row.reference,
      path: row.path,
      branch: row.branch,
      baseRef: row.base_ref,
      baseSha: row.base_sha,
      port: row.port,
      subdomain: row.subdomain,
      createdAt: row.created_at,
    }
  }

  function freePortFor(branch: string, worktreeId: number): number {
    const held = previousPort.get(worktreeId)
    if (held !== undefined && takenPort.get(held.port) === undefined && isPortFree(held.port)) {
      return held.port
    }
    const wanted = allocatePort(branch)
    for (let step = 0; step < DEFAULT_PORT_RANGE; step += 1) {
      const candidate = ((wanted - DEFAULT_BASE_PORT + step) % DEFAULT_PORT_RANGE) + DEFAULT_BASE_PORT
      if (takenPort.get(candidate) === undefined && isPortFree(candidate)) {
        return candidate
      }
    }
    throw new WorktreeNotRemovableError(branch, 'plus aucun port libre dans la plage')
  }

  return {
    open: (order) => {
      const story = stories.findStory(order.storyId)
      if (selectLiveForStory.get(order.storyId) !== undefined) {
        throw new WorktreeAlreadyLiveError(story.reference, branchNameFor(story.reference, story.title))
      }
      const branch = branchNameFor(story.reference, story.title)
      const folder = worktreeFolderFor(branch)
      const path = join(root, folder)
      const baseSha = git.headSha(order.baseRef)

      const existing = selectRowForStory.get(order.storyId)
      if (existing === undefined) {
        insertWorktree.run(order.storyId, path, branch, order.baseRef, baseSha)
      } else {
        reopenWorktree.run(path, branch, baseSha, existing.id)
      }
      const written = selectRowForStory.get(order.storyId)
      if (written === undefined) {
        throw new WorktreeNotFoundError(story.reference)
      }

      const port = freePortFor(branch, written.id)
      dropReservation.run(written.id)
      insertReservation.run(port, written.id, folder)

      git.addWorktree({ path, branch, baseRef: order.baseRef })

      const live = selectLiveForStory.get(order.storyId)
      if (live === undefined) {
        throw new WorktreeNotFoundError(story.reference)
      }
      return toWorktree(live)
    },

    close: (storyId, options = {}) => {
      const story = stories.findStory(storyId)
      const live = selectLiveForStory.get(storyId)
      if (live === undefined) {
        throw new WorktreeNotFoundError(story.reference)
      }
      if (options.force !== true && git.isDirty(live.path)) {
        throw new WorktreeNotRemovableError(live.branch, 'du travail non commite y dort encore')
      }
      git.removeWorktree(live.path)
      if (options.deleteBranch === true) {
        git.deleteBranch(live.branch)
      }
      releaseReservation.run(live.id)
      markRemoved.run(live.id)
    },

    findForStory: (storyId) => {
      const live = selectLiveForStory.get(storyId)
      return live === undefined ? null : toWorktree(live)
    },

    listLive: () => selectLive.all().map(toWorktree),
  }
}
