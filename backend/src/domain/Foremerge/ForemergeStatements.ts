import type Database from 'better-sqlite3'

export type ReservationRow = {
  id: number
  story_id: number
  reference: string
  path_prefix: string
  symbols: string
  reserved_at: string
}

export function prepareForemergeStatements(db: Database.Database) {
  return {
    selectLive: db.prepare<[], ReservationRow>(`
      SELECT reservation.id, reservation.story_id, story.reference, reservation.path_prefix,
             reservation.symbols, reservation.reserved_at
      FROM scope_reservation AS reservation
      JOIN story ON story.id = reservation.story_id
      WHERE reservation.released_at IS NULL
      ORDER BY reservation.id ASC
    `),

    insertReservation: db.prepare<[number, string, string]>(
      'INSERT INTO scope_reservation (story_id, path_prefix, symbols, renewed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
    ),

    clearRelease: db.prepare<[number, string]>(`
      UPDATE scope_reservation
      SET reserved_at = CASE WHEN released_at IS NULL THEN reserved_at ELSE CURRENT_TIMESTAMP END,
          renewed_at = CURRENT_TIMESTAMP,
          released_at = NULL
      WHERE story_id = ? AND path_prefix = ?
    `),

    expireLapsed: db.prepare<[string, string]>(`
      UPDATE scope_reservation
      SET released_at = datetime(COALESCE(renewed_at, reserved_at), ?)
      WHERE released_at IS NULL AND COALESCE(renewed_at, reserved_at) <= datetime('now', ?)
    `),

    renewHeld: db.prepare<[number]>(
      'UPDATE scope_reservation SET renewed_at = CURRENT_TIMESTAMP WHERE story_id = ? AND released_at IS NULL',
    ),

    releaseAll: db.prepare<[number]>(
      "UPDATE scope_reservation SET released_at = datetime('now') WHERE story_id = ? AND released_at IS NULL",
    ),

    selectOne: db.prepare<[number, string], ReservationRow>(`
      SELECT reservation.id, reservation.story_id, story.reference, reservation.path_prefix,
             reservation.symbols, reservation.reserved_at
      FROM scope_reservation AS reservation
      JOIN story ON story.id = reservation.story_id
      WHERE reservation.story_id = ? AND reservation.path_prefix = ?
    `),
  }
}
