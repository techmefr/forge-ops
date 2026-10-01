import type Database from 'better-sqlite3'

export type PreferenceRepository = {
  read: (userId: number, key: string) => string | null
  write: (userId: number, key: string, value: string) => void
}

export function createPreferenceRepository(db: Database.Database): PreferenceRepository {
  const select = db.prepare<[number, string], { value: string }>(
    'SELECT value FROM user_preference WHERE user_id = ? AND key = ?',
  )
  const upsert = db.prepare<[number, string, string]>(
    `INSERT INTO user_preference (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
  )
  return {
    read: (userId, key) => select.get(userId, key)?.value ?? null,
    write: (userId, key, value) => {
      upsert.run(userId, key, value)
    },
  }
}
