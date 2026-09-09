import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { openDatabase } from '../Database/Connection.js'
import { createStoryRepository } from '../../domain/Story/StoryRepository.js'
import { createForemergeRepository } from '../../domain/Foremerge/ForemergeRepository.js'
import { decideOnScopePayload } from './ScopeDecision.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = join(MODULE_DIR, '..', '..', '..', '..')
const DB_PATH = process.env.FORGE_DB_PATH ?? join(REPOSITORY_ROOT, 'forge.db')

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    process.stdin.on('data', (chunk) => {
      raw += chunk
    })
    process.stdin.on('end', () => resolve(raw))
    process.stdin.on('error', reject)
  })
}

function reservations() {
  const db = openDatabase(DB_PATH)
  try {
    return createForemergeRepository(db, { stories: createStoryRepository(db) }).listReservations()
  } finally {
    db.close()
  }
}

const decision = decideOnScopePayload(await readStdin(), {
  reference: process.env.FORGE_STORY_REFERENCE ?? null,
  read: reservations,
  root: process.env.CLAUDE_PROJECT_DIR ?? REPOSITORY_ROOT,
})

if (!decision.allowed) {
  console.error(decision.reason)
  process.exit(2)
}

process.exit(0)
