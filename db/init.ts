import { getDb } from '../src/db/connection.js'

function main(): void {
  const db = getDb()
  const row = db.pragma('journal_mode', { simple: true })
  console.log(`Base initialisee, journal_mode=${row}`)
}

main()
