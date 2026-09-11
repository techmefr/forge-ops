import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from './technical/Database/Connection.js'
import { seedDemoBoard } from './technical/Seed/DemoSeed.js'
import { defaultBoardServerInput, startBoardServer } from './technical/Http/BoardServer.js'
import { closeOnSignals } from './technical/Http/Shutdown.js'
import { resolveBoardToken } from './technical/Auth/BoardToken.js'
import {
  buildWebBundle,
  demoAccessLines,
  discardDemoDatabase,
  inspectDemoBundle,
} from './technical/Demo/DemoRuntime.js'

const defaults = defaultBoardServerInput()
const dbPath = process.env.FORGE_DB_PATH ?? 'forge-demo.db'
const worktreeRoot = process.env.FORGE_WORKTREE_ROOT ?? join(tmpdir(), 'forge-demo-worktrees')
const shotDir = process.env.FORGE_SHOT_DIR ?? join(tmpdir(), 'forge-demo-shots')

const removed = discardDemoDatabase(dbPath)
console.log(
  removed.length === 0
    ? `Aucune base de demonstration a remplacer, ${dbPath} est neuve`
    : `Base de demonstration precedente effacee : ${removed.join(', ')}`,
)

const db = openDatabase(dbPath)
const board = seedDemoBoard(db)
db.close()
console.log(
  `Base ${dbPath} semee : ${board.projects} projets, ${board.stories} stories, ${board.zones} zones, ${board.sessions} sessions`,
)

let bundle = inspectDemoBundle(defaults.distDir)
if (!bundle.built) {
  console.log(`Bundle web absent (${bundle.reason}), compilation en cours`)
  if (!buildWebBundle(process.cwd())) {
    console.error('La compilation du bundle web a echoue, le board ne servirait rien')
    process.exit(1)
  }
  bundle = inspectDemoBundle(defaults.distDir)
  if (!bundle.built) {
    console.error(`Bundle web toujours introuvable apres compilation : ${bundle.reason}`)
    process.exit(1)
  }
  console.log(`Bundle web compile dans ${bundle.distDir}`)
} else {
  console.log(`Bundle web deja present dans ${bundle.distDir}`)
}

mkdirSync(worktreeRoot, { recursive: true })
mkdirSync(shotDir, { recursive: true })

const token = resolveBoardToken(defaults.tokenPath)
const running = await startBoardServer({ ...defaults, dbPath, worktreeRoot, shotDir })

closeOnSignals(running)

for (const line of demoAccessLines({ port: running.port, token })) {
  console.log(line)
}
