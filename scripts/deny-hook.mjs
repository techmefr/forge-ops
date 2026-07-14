#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DENY_PATH = join(SCRIPT_DIR, '..', '.claude-deny.json')

function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, (match) => (match === '*' ? match : `\\${match}`))
}

function patternToRegExp(pattern) {
  const escaped = escapeRegExp(pattern).replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 's')
}

function loadDenyPatterns() {
  const raw = readFileSync(DENY_PATH, 'utf-8')
  return JSON.parse(raw).deny
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = ''
    process.stdin.on('data', (chunk) => {
      raw += chunk
    })
    process.stdin.on('end', () => resolve(raw))
    process.stdin.on('error', reject)
  })
}

async function main() {
  const raw = await readStdin()
  const payload = JSON.parse(raw)

  if (payload.tool_name !== 'Bash') {
    process.exit(0)
  }

  const command = (payload.tool_input?.command ?? '').trim()
  const patterns = loadDenyPatterns()
  const matched = patterns.find((pattern) => patternToRegExp(pattern).test(command))

  if (matched !== undefined) {
    console.error(`Commande bloquee par .claude-deny.json (pattern: ${matched}): ${command}`)
    process.exit(2)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error(`deny-hook a echoue: ${error.message}`)
  process.exit(0)
})
