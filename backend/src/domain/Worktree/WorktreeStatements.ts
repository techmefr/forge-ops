import type Database from 'better-sqlite3'
import type { Worktree } from './Worktree.js'

type WorktreeRow = {
  id: number
  story_id: number
  reference: string
  forge_card_id: number | null
  path: string
  branch: string
  base_ref: string
  base_sha: string
  port: number
  subdomain: string
  created_at: string
}

export type WorktreeStatements = ReturnType<typeof prepareWorktreeStatements>

const LIVE_SELECTION = `
  SELECT worktree.id, worktree.story_id, story.reference, worktree.forge_card_id, worktree.path,
         worktree.branch, worktree.base_ref, worktree.base_sha, reservation.port, reservation.subdomain,
         worktree.created_at
  FROM worktree
  JOIN story ON story.id = worktree.story_id
  JOIN port_reservation AS reservation ON reservation.worktree_id = worktree.id
  WHERE worktree.removed_at IS NULL AND reservation.released_at IS NULL
`

export function toWorktree(row: WorktreeRow): Worktree {
  return {
    id: row.id,
    storyId: row.story_id,
    storyReference: row.reference,
    forgeCardId: row.forge_card_id,
    path: row.path,
    branch: row.branch,
    baseRef: row.base_ref,
    baseSha: row.base_sha,
    port: row.port,
    subdomain: row.subdomain,
    createdAt: row.created_at,
  }
}

export function prepareWorktreeStatements(db: Database.Database) {
  return {
    selectLive: db.prepare<[], WorktreeRow>(`${LIVE_SELECTION} ORDER BY worktree.id ASC`),
    selectLiveForStory: db.prepare<[number], WorktreeRow>(`${LIVE_SELECTION} AND worktree.story_id = ?`),
    selectRowForStory: db.prepare<[number], { id: number; path: string }>(
      'SELECT id, path FROM worktree WHERE story_id = ?',
    ),
    insertWorktree: db.prepare<[number, number | null, string, string, string, string]>(
      'INSERT INTO worktree (story_id, forge_card_id, path, branch, base_ref, base_sha) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    reopenWorktree: db.prepare<[string, string, string, number | null, number]>(
      'UPDATE worktree SET removed_at = NULL, path = ?, branch = ?, base_sha = ?, forge_card_id = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
    ),
    takenPort: db.prepare<[number], { port: number }>(
      'SELECT port FROM port_reservation WHERE port = ? AND released_at IS NULL',
    ),
    previousPort: db.prepare<[number], { port: number }>('SELECT port FROM port_reservation WHERE worktree_id = ?'),
    dropReservation: db.prepare<[number]>('DELETE FROM port_reservation WHERE worktree_id = ?'),
    insertReservation: db.prepare<[number, number, string]>(
      'INSERT INTO port_reservation (port, worktree_id, subdomain) VALUES (?, ?, ?)',
    ),
    releaseReservation: db.prepare<[number]>(
      "UPDATE port_reservation SET released_at = datetime('now') WHERE worktree_id = ? AND released_at IS NULL",
    ),
    markRemoved: db.prepare<[number]>("UPDATE worktree SET removed_at = datetime('now') WHERE id = ?"),
  }
}
