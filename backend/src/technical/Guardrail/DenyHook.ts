import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { decideOnToolCall } from './PhaseDecision.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DENY_PATH = process.env.FORGE_DENY_PATH ?? join(MODULE_DIR, '..', '..', '..', '.claude-deny.json')

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

const decision = decideOnToolCall(await readStdin(), {
  denyPath: DENY_PATH,
  phase: process.env.FORGE_PHASE ?? null,
})

if (!decision.allowed) {
  console.error(decision.reason)
  process.exit(2)
}

process.exit(0)
