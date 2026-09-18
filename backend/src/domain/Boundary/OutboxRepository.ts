import type Database from 'better-sqlite3'
import type { OutboxEntry } from './Boundary.js'

export type OutboxRepository = {
  owe: (kind: string, payload: unknown) => OutboxEntry
  owed: (limit?: number) => readonly OutboxEntry[]
  depth: () => number
  settle: (entryId: number) => void
  failed: (entryId: number) => OutboxEntry
}

type OutboxRow = {
  id: number
  kind: string
  payload: string
  queued_at: string
  sent_at: string | null
  attempts: number
}

const DEFAULT_BATCH = 50

export function createOutboxRepository(db: Database.Database): OutboxRepository {
  const insert = db.prepare<[string, string]>(
    'INSERT INTO sync_outbox (kind, payload) VALUES (?, ?)',
  )
  const selectOne = db.prepare<[number], OutboxRow>(
    'SELECT id, kind, payload, queued_at, sent_at, attempts FROM sync_outbox WHERE id = ?',
  )
  const selectOwed = db.prepare<[number], OutboxRow>(
    `SELECT id, kind, payload, queued_at, sent_at, attempts FROM sync_outbox
      WHERE sent_at IS NULL ORDER BY id LIMIT ?`,
  )
  const countOwed = db.prepare<[], { owed: number }>(
    'SELECT COUNT(*) AS owed FROM sync_outbox WHERE sent_at IS NULL',
  )
  const markSent = db.prepare<[number]>(
    "UPDATE sync_outbox SET sent_at = datetime('now') WHERE id = ? AND sent_at IS NULL",
  )
  const markTried = db.prepare<[number]>(
    'UPDATE sync_outbox SET attempts = attempts + 1 WHERE id = ?',
  )

  function toEntry(row: OutboxRow): OutboxEntry {
    return {
      id: row.id,
      kind: row.kind,
      payload: row.payload,
      queuedAt: row.queued_at,
      sentAt: row.sent_at,
      attempts: row.attempts,
    }
  }

  function find(entryId: number): OutboxEntry {
    const row = selectOne.get(entryId)
    if (row === undefined) {
      throw new RangeError(`aucune dette ${entryId} dans la file`)
    }
    return toEntry(row)
  }

  return {
    owe: (kind, payload) => {
      const written = insert.run(kind, JSON.stringify(payload))
      return find(Number(written.lastInsertRowid))
    },

    owed: (limit = DEFAULT_BATCH) => selectOwed.all(limit).map(toEntry),

    depth: () => countOwed.get()?.owed ?? 0,

    settle: (entryId) => {
      markSent.run(entryId)
    },

    failed: (entryId) => {
      markTried.run(entryId)
      return find(entryId)
    },
  }
}
