import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveHookToken, resolveBoardToken } from './technical/Auth/BoardToken.js'
import { installGuardrails } from './technical/Guardrail/GuardrailInstall.js'
import { defaultBoardServerInput } from './composition/BoardServer.js'

const FORGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const checkout = process.argv[2]

if (checkout === undefined || checkout.trim() === '') {
  process.stderr.write('Usage: npm run guardrails:install -- <project checkout path>\n')
  process.exit(1)
}

const { port, tokenPath } = defaultBoardServerInput()
const result = installGuardrails({
  checkout,
  forgeRoot: FORGE_ROOT,
  hook: { port, token: deriveHookToken(resolveBoardToken(tokenPath)) },
})

process.stdout.write(`PreToolUse guardrails (DenyHook, ScopeHook) written to ${result.settingsPath}\n`)
process.stdout.write(`PostToolUse hook with its token written to ${result.localSettingsPath ?? join(checkout, '.claude', 'settings.local.json')}\n`)
process.stdout.write('settings.json contains absolute paths to this forge-ops install and no secret.\n')
process.stdout.write(
  result.excludeFile === null
    ? 'settings.local.json holds the hook token: this is not a git checkout, keep it out of version control.\n'
    : `settings.local.json holds the hook token: it is ignored through ${result.excludeFile} and copied into every story worktree.\n`,
)
