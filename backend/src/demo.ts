import { mkdirSync } from 'node:fs'
import { demoEnvironment } from './domain/Demo/DemoEnvironment.js'
import { openDatabase } from './technical/Database/Connection.js'
import { markDemoDatabase } from './technical/Demo/DemoMark.js'
import { seedDemoBoard } from './composition/DemoSeed.js'
import { defaultBoardServerInput, startBoardServer } from './composition/BoardServer.js'
import { closeOnSignals } from './technical/Http/Shutdown.js'
import { resolveBoardToken } from './technical/Auth/BoardToken.js'
import {
  buildWebBundle,
  createDemoRunRoot,
  demoAccessLines,
  discardDemoDatabase,
  inspectDemoBundle,
} from './technical/Demo/DemoRuntime.js'

const defaults = defaultBoardServerInput()
const runRoot = createDemoRunRoot()
const environment = demoEnvironment(runRoot)
const { dbPath, worktreeRoot, shotDir } = environment

console.log(`Mode ${environment.mode} declare, tout tient dans ${runRoot}`)

const discard = discardDemoDatabase(dbPath)
if (discard.refused !== null) {
  console.error(discard.refused)
  process.exit(1)
}
console.log(
  discard.removed.length === 0
    ? `Aucune base de demonstration a remplacer, ${dbPath} est neuve`
    : `Base de demonstration precedente effacee : ${discard.removed.join(', ')}`,
)

const db = openDatabase(dbPath)
markDemoDatabase(db)
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
