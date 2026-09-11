import { openDatabase } from './technical/Database/Connection.js'
import { seedDemoBoard } from './technical/Seed/DemoSeed.js'

const dbPath = process.env.FORGE_DB_PATH ?? 'forge-demo.db'
const db = openDatabase(dbPath)
const board = seedDemoBoard(db)
db.close()

console.log(`Base de demonstration ${dbPath}`)
console.log(
  `${board.projects} projets, ${board.stories} stories au kanban, ${board.zones} zones, ${board.sessions} sessions`,
)
console.log(`Lancer le board dessus : FORGE_DB_PATH=${dbPath} npm run forge`)
