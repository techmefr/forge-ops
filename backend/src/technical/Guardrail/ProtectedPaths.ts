import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SETTINGS_FILE = /^\.claude\/settings[^/]*\.json$/
const HOOKS_FOLDER = '.claude/hooks'
const DENY_FILE = '.claude-deny.json'
const MCP_FILE = '.mcp.json'
const GIT_FOLDER = '.git'
const GUARDRAIL_FOLDER = 'backend/src/technical/Guardrail'

const OWN_GUARDRAIL_FOLDER = dirname(fileURLToPath(import.meta.url))

export function realPathOf(path: string): string {
  let probe = resolve(path)
  while (!existsSync(probe)) {
    const parent = dirname(probe)
    if (parent === probe) {
      return resolve(path)
    }
    probe = parent
  }
  return resolve(realpathSync(probe), relative(probe, resolve(path)))
}

function within(folder: string, path: string): boolean {
  const walked = relative(folder, path)
  return walked === '' || (!walked.startsWith('..') && !isAbsolute(walked))
}

export function relativeToRoot(root: string, path: string): string | null {
  const walked = relative(realPathOf(root), realPathOf(path))
  if (walked.startsWith('..') || isAbsolute(walked)) {
    return null
  }
  return walked.split(sep).join('/')
}

function protectedRelative(rel: string): boolean {
  const lowered = rel.toLowerCase()
  return (
    SETTINGS_FILE.test(lowered) ||
    lowered === HOOKS_FOLDER ||
    lowered.startsWith(`${HOOKS_FOLDER}/`) ||
    lowered === DENY_FILE ||
    lowered === MCP_FILE ||
    lowered === GIT_FOLDER ||
    lowered.startsWith(`${GIT_FOLDER}/`) ||
    lowered === GUARDRAIL_FOLDER.toLowerCase() ||
    lowered.startsWith(`${GUARDRAIL_FOLDER.toLowerCase()}/`)
  )
}

export function isProtectedPath(root: string, path: string): boolean {
  if (within(realPathOf(OWN_GUARDRAIL_FOLDER), realPathOf(path))) {
    return true
  }
  const rel = relativeToRoot(root, path)
  return rel !== null && protectedRelative(rel)
}
