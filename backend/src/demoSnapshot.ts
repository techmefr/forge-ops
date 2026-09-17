import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { demoEnvironment } from './domain/Demo/DemoEnvironment.js'
import { openDatabase } from './technical/Database/Connection.js'
import { markDemoDatabase } from './technical/Demo/DemoMark.js'
import { seedDemoBoard } from './composition/DemoSeed.js'
import { defaultBoardServerInput, startBoardServer } from './composition/BoardServer.js'
import { resolveBoardToken } from './technical/Auth/BoardToken.js'
import { PARAMETERLESS_PATHS, PROJECT_PATHS, STORY_PATHS } from './domain/Demo/DemoSnapshotPaths.js'
import { identifiersIn } from './domain/Demo/DemoIdentifier.js'

const OUT = process.argv[2] ?? join('frontend', 'public', 'demo-snapshot.json')
const PORT = Number(process.env.FORGE_SNAPSHOT_PORT ?? 8841)

const runRoot = mkdtempSync(join(tmpdir(), 'forge-snapshot-'))
const environment = demoEnvironment(runRoot)
mkdirSync(dirname(environment.dbPath), { recursive: true })

const db = openDatabase(environment.dbPath)
markDemoDatabase(db)
const seeded = seedDemoBoard(db)
db.close()

const tokenPath = join(runRoot, '.forge-token')
const token = resolveBoardToken(tokenPath)

const board = await startBoardServer({
  ...defaultBoardServerInput(),
  port: PORT,
  host: '127.0.0.1',
  dbPath: environment.dbPath,
  tokenPath,
  worktreeRoot: environment.worktreeRoot,
  shotDir: environment.shotDir,
  mode: 'local',
  environmentMode: 'demo',
})

const snapshot: Record<string, unknown> = {}

async function capture(path: string): Promise<unknown | null> {
  const response = await fetch(`http://127.0.0.1:${board.port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    return null
  }
  const raw = await response.text()
  const payload: unknown = raw === '' ? null : (JSON.parse(raw) as unknown)
  snapshot[path] = payload
  return payload
}

const roots: unknown[] = []
for (const path of PARAMETERLESS_PATHS) {
  const payload = await capture(path)
  if (payload !== null) {
    roots.push(payload)
  }
}

const identifiers = identifiersIn(roots)
const found: unknown[] = []
for (const identifier of identifiers) {
  for (const template of [...PROJECT_PATHS, ...STORY_PATHS]) {
    const payload = await capture(template.replace(':id', String(identifier)))
    if (payload !== null) {
      found.push(payload)
    }
  }
}

for (const identifier of identifiersIn(found)) {
  for (const template of STORY_PATHS) {
    await capture(template.replace(':id', String(identifier)))
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')

await board.close()

console.log(
  `${seeded.projects} projets et ${seeded.stories} stories figes dans ${OUT} : ${Object.keys(snapshot).length} reponses`,
)
process.exit(0)
