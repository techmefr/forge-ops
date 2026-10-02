import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decideToolPermission } from '../../../src/technical/Guardrail/ToolPermission.js'

describe('decideToolPermission', () => {
  let root: string
  let outside: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'perm-root-'))
    outside = mkdtempSync(join(tmpdir(), 'perm-out-'))
    mkdirSync(join(root, '.claude', 'evidence'), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })

  it('lets a build session write and edit inside its directory', () => {
    expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: join(root, 'a.ts') }, root }).behavior).toBe('allow')
    expect(decideToolPermission({ phase: 'tdd', tool: 'Edit', input: { file_path: 'src/b.ts' }, root }).behavior).toBe('allow')
  })

  it('lets a build session run shell commands such as tests and commits', () => {
    expect(decideToolPermission({ phase: 'code', tool: 'Bash', input: { command: 'git commit -m x' }, root }).behavior).toBe('allow')
  })

  it('denies writes outside the directory, by path and through a symlink', () => {
    expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: join(outside, 'x') }, root }).behavior).toBe('deny')
    expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: '../escape' }, root }).behavior).toBe('deny')
    symlinkSync(outside, join(root, 'link'))
    expect(decideToolPermission({ phase: 'code', tool: 'Write', input: { file_path: 'link/x' }, root }).behavior).toBe('deny')
  })

  it('denies a write without a path', () => {
    expect(decideToolPermission({ phase: 'code', tool: 'Write', input: {}, root }).behavior).toBe('deny')
  })

  it('limits spec and architecture sessions to the evidence folder', () => {
    for (const phase of ['spec', 'architecture']) {
      expect(decideToolPermission({ phase, tool: 'Write', input: { file_path: '.claude/evidence/S-1/spec.md' }, root }).behavior).toBe('allow')
      expect(decideToolPermission({ phase, tool: 'Write', input: { file_path: 'src/a.ts' }, root }).behavior).toBe('deny')
      expect(decideToolPermission({ phase, tool: 'Bash', input: { command: 'ls' }, root }).behavior).toBe('deny')
    }
  })

  it('denies writing tools in review and ship phases and unknown phases', () => {
    expect(decideToolPermission({ phase: 'review', tool: 'Write', input: { file_path: 'a' }, root }).behavior).toBe('deny')
    expect(
      decideToolPermission({ phase: 'review', tool: 'Write', input: { file_path: '.claude/evidence/S-1/review.verdict.json' }, root })
        .behavior,
    ).toBe('allow')
    expect(decideToolPermission({ phase: 'review', tool: 'Bash', input: { command: 'git status' }, root }).behavior).toBe('allow')
    expect(decideToolPermission({ phase: 'nope', tool: 'Read', input: {}, root }).behavior).toBe('deny')
  })

  it('denies reads outside the directory', () => {
    expect(decideToolPermission({ phase: 'code', tool: 'Read', input: { file_path: join(outside, 's') }, root }).behavior).toBe('deny')
    expect(decideToolPermission({ phase: 'code', tool: 'Grep', input: { pattern: 'x' }, root }).behavior).toBe('allow')
  })
})
