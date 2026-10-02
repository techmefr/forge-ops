import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGuardrailSeal } from '../../../src/technical/Guardrail/GuardrailSeal.js'
import { isProtectedPath } from '../../../src/technical/Guardrail/ProtectedPaths.js'
import { decideOnScopePayload } from '../../../src/technical/Guardrail/ScopeDecision.js'
import { decideToolPermission } from '../../../src/technical/Guardrail/ToolPermission.js'

describe('guardrail files', () => {
  let root: string
  let forgeRoot: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'seal-root-'))
    forgeRoot = mkdtempSync(join(tmpdir(), 'seal-forge-'))
    execFileSync('git', ['init', '-q'], { cwd: root })
    mkdirSync(join(root, '.claude', 'hooks'), { recursive: true })
    mkdirSync(join(root, '.claude', 'evidence', 'S-1'), { recursive: true })
    writeFileSync(join(root, '.claude', 'settings.json'), '{"hooks":{}}')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    rmSync(forgeRoot, { recursive: true, force: true })
  })

  describe('write protection in every phase', () => {
    const PROTECTED = [
      '.claude/settings.json',
      '.claude/settings.local.json',
      '.claude/settings.team.json',
      '.claude/hooks/pre.sh',
      '.claude-deny.json',
      '.mcp.json',
      '.git/config',
      '.git/hooks/pre-commit',
      'backend/src/technical/Guardrail/DenyHook.ts',
      '.CLAUDE/Settings.json',
    ]

    it.each(PROTECTED)('denies the Write tool on %s in the tdd and code phases', (file) => {
      for (const phase of ['tdd', 'code']) {
        for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
          const input = tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file }
          expect(decideToolPermission({ phase, tool, input, root }).behavior, `${tool} ${file}`).toBe('deny')
        }
      }
    })

    it.each(PROTECTED)('denies %s through an absolute path and a dot segment', (file) => {
      expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: join(root, file) }, root }).behavior).toBe('deny')
      expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: `./backend/../${file}` }, root }).behavior).toBe('deny')
    })

    it('denies the hook script of the scope hook as well, whoever asks', () => {
      for (const phase of ['tdd', 'code']) {
        const raw = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '.claude/settings.json' } })
        const decision = decideOnScopePayload(raw, { reference: null, read: () => [], root })
        expect(decision.allowed, phase).toBe(false)
      }
    })

    it('treats the install own guardrail folder as protected wherever the checkout is', () => {
      expect(isProtectedPath(root, join(import.meta.dirname, '..', '..', '..', 'src', 'technical', 'Guardrail', 'DenyHook.ts'))).toBe(true)
    })

    it('still lets a code session write ordinary files, evidence and sibling dotfiles', () => {
      for (const file of ['backend/a.ts', '.claude/evidence/S-1/build.md', '.gitignore', '.claude/commands/x.md']) {
        expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: file }, root }).behavior, file).toBe('allow')
      }
    })

    it('denies a write that reaches settings through a symlinked folder', () => {
      execFileSync('ln', ['-s', join(root, '.claude'), join(root, 'alias')])

      expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: 'alias/settings.json' }, root }).behavior).toBe('deny')
    })
  })

  describe('seal', () => {
    it('reports nothing when the guardrail files are untouched', () => {
      const seal = createGuardrailSeal(forgeRoot)
      seal.seal(root)

      expect(seal.changesSince(root)).toEqual([])
    })

    it.each([
      ['rewritten settings', () => writeFileSync(join(root, '.claude', 'settings.json'), '{"permissions":{"allow":["Bash(*)"]}}')],
      ['a new local settings file', () => writeFileSync(join(root, '.claude', 'settings.local.json'), '{}')],
      ['a new hook script', () => writeFileSync(join(root, '.claude', 'hooks', 'x.sh'), 'exit 0')],
      ['a new mcp config', () => writeFileSync(join(root, '.mcp.json'), '{}')],
      ['a changed deny list', () => writeFileSync(join(root, '.claude-deny.json'), '{"deny":[]}')],
      ['a changed git config', () => writeFileSync(join(root, '.git', 'config'), '[core]\n\thooksPath = /tmp\n')],
      ['a new git hook', () => writeFileSync(join(root, '.git', 'hooks', 'pre-push'), '#!/bin/sh\nexit 0\n')],
    ])('detects %s', (_name, tamper) => {
      const seal = createGuardrailSeal(forgeRoot)
      seal.seal(root)

      tamper()

      expect(seal.changesSince(root).length).toBeGreaterThan(0)
    })

    it('detects a change to the forge guardrail files themselves', () => {
      const folder = join(forgeRoot, 'backend', 'src', 'technical', 'Guardrail')
      mkdirSync(folder, { recursive: true })
      writeFileSync(join(folder, 'DenyHook.ts'), 'process.exit(2)')
      const seal = createGuardrailSeal(forgeRoot)
      seal.seal(root)

      writeFileSync(join(folder, 'DenyHook.ts'), 'process.exit(0)')

      expect(seal.changesSince(root)).toHaveLength(1)
    })

    it('ignores evidence and source files', () => {
      const seal = createGuardrailSeal(forgeRoot)
      seal.seal(root)

      writeFileSync(join(root, '.claude', 'evidence', 'S-1', 'build.verdict.json'), '{}')
      writeFileSync(join(root, 'a.ts'), 'export {}')

      expect(seal.changesSince(root)).toEqual([])
    })

    it('keeps a tampered checkout refused until the operator forgets it', () => {
      const seal = createGuardrailSeal(forgeRoot)
      seal.seal(root)
      writeFileSync(join(root, '.mcp.json'), '{}')

      seal.markTampered(root, seal.changesSince(root))

      expect(seal.tamperedReason(root)).toContain('.mcp.json')
      seal.forget(root)
      expect(seal.tamperedReason(root)).toBeNull()
    })
  })
})
