import { readFileSync } from 'node:fs'
import { GATE_SCRIPTS, missingScripts, reportMissingScripts } from './domain/Gate/RequiredScript.js'

const required = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [...GATE_SCRIPTS]
const manifest = JSON.parse(readFileSync('package.json', 'utf-8')) as {
  scripts?: Record<string, string>
}
const missing = missingScripts(manifest.scripts ?? {}, required)

process.stdout.write(`${reportMissingScripts(missing)}\n`)
process.exit(missing.length === 0 ? 0 : 1)
