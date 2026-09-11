import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  isWriteTool,
  READ_TOOLS,
  SHELL_TOOLS,
  WRITE_TOOL_MATCHER,
  WRITE_TOOLS,
} from '../../../src/domain/Agent/ToolName.js'
import { AGENT_PHASE_SEQUENCE } from '../../../src/domain/Agent/AgentSession.js'
import { allowsTool, PHASE_TOOL_POLICY } from '../../../src/technical/Guardrail/PhaseToolPolicy.js'
import { buildHookSettings } from '../../../src/technical/Auth/HookSettings.js'
import { WRITING_TOOLS } from '../../../src/technical/Guardrail/ScopeDecision.js'

const PROJECT_SETTINGS = fileURLToPath(new URL('../../../../.claude/settings.json', import.meta.url))

type HookEntry = { matcher: string; hooks: readonly { args?: readonly string[] }[] }

function scopeMatcherOfProjectSettings(): string {
  const raw = JSON.parse(readFileSync(PROJECT_SETTINGS, 'utf8')) as {
    hooks: { PreToolUse: readonly HookEntry[] }
  }
  const entry = raw.hooks.PreToolUse.find((candidate) =>
    candidate.hooks.some((hook) => (hook.args ?? []).some((arg) => arg.endsWith('ScopeHook.ts'))),
  )
  if (entry === undefined) {
    throw new Error('no PreToolUse entry wires the scope hook')
  }
  return entry.matcher
}

describe('write tool source of truth', () => {
  it('names every tool that writes to a file', () => {
    expect(WRITE_TOOLS).toEqual(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
  })

  it('shares no tool between reading, writing and shelling', () => {
    const all = [...READ_TOOLS, ...WRITE_TOOLS, ...SHELL_TOOLS]
    expect(new Set(all).size).toBe(all.length)
  })

  it('lets the scope guardrail derive its list instead of restating it', () => {
    expect(WRITING_TOOLS).toEqual([...WRITE_TOOLS])
  })

  it('opens every write tool in the phases that may write', () => {
    for (const phase of ['tdd', 'code'] as const) {
      for (const tool of WRITE_TOOLS) {
        expect(PHASE_TOOL_POLICY[phase]).toContain(tool)
      }
    }
  })

  it('closes every write tool in the phases that may not write', () => {
    for (const phase of ['spec', 'architecture', 'gate', 'review', 'ship'] as const) {
      for (const tool of WRITE_TOOLS) {
        expect(PHASE_TOOL_POLICY[phase]).not.toContain(tool)
      }
    }
  })

  it('builds the session hook matcher from the same list', () => {
    const settings = buildHookSettings({ port: 4210, token: 'secret' }) as {
      hooks: { PostToolUse: readonly HookEntry[] }
    }
    expect(settings.hooks.PostToolUse[0]?.matcher.split('|')).toEqual([...WRITE_TOOLS])
  })

  it('keeps the project scope hook matcher in step with the same list', () => {
    expect(scopeMatcherOfProjectSettings().split('|')).toEqual([...WRITE_TOOLS])
    expect(WRITE_TOOL_MATCHER).toBe(scopeMatcherOfProjectSettings())
  })
})

describe('guardrail fail-closed', () => {
  it('refuses an unknown tool in every phase', () => {
    for (const phase of AGENT_PHASE_SEQUENCE) {
      expect(allowsTool(phase, 'Frobnicate')).toBe(false)
    }
  })

  it('refuses any tool in an unknown phase', () => {
    expect(allowsTool('deployment', 'Read')).toBe(false)
    expect(allowsTool('deployment', 'Write')).toBe(false)
  })

  it('does not take an unknown tool for a write tool', () => {
    expect(isWriteTool('Frobnicate')).toBe(false)
    expect(isWriteTool('write')).toBe(false)
    expect(isWriteTool('')).toBe(false)
  })
})
