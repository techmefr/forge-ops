import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { demoEnvironment, realEnvironment } from '../../../src/domain/Demo/DemoEnvironment.js'

describe('demoEnvironment', () => {
  const runRoot = join('run', 'root')

  it('declares the demo mode rather than reading it anywhere', () => {
    expect(demoEnvironment(runRoot).mode).toBe('demo')
  })

  it('keeps every demo path under the run root it was given', () => {
    const environment = demoEnvironment(runRoot)

    for (const path of [
      environment.dbPath,
      environment.worktreeRoot,
      environment.shotDir,
      environment.tokenPath,
    ]) {
      expect(path.startsWith(runRoot)).toBe(true)
    }
  })

  it('never hands out a real board token, even when one already exists in the repo', () => {
    const environment = demoEnvironment(runRoot)

    expect(environment.tokenPath).not.toBe('.forge-token')
  })

  it('ignores the ambient variables a real board reads', () => {
    process.env.FORGE_DB_PATH = join('ailleurs', 'reelle.db')
    process.env.FORGE_WORKTREE_ROOT = join('ailleurs', 'worktrees')
    process.env.FORGE_SHOT_DIR = join('ailleurs', 'shots')
    process.env.FORGE_TOKEN_PATH = join('ailleurs', '.forge-token')
    try {
      const environment = demoEnvironment(runRoot)

      expect(environment.dbPath).not.toContain('ailleurs')
      expect(environment.worktreeRoot).not.toContain('ailleurs')
      expect(environment.shotDir).not.toContain('ailleurs')
      expect(environment.tokenPath).not.toContain('ailleurs')
    } finally {
      delete process.env.FORGE_DB_PATH
      delete process.env.FORGE_WORKTREE_ROOT
      delete process.env.FORGE_SHOT_DIR
      delete process.env.FORGE_TOKEN_PATH
    }
  })

  it('gives two runs two separate roots', () => {
    expect(demoEnvironment(join('run', 'one')).dbPath).not.toBe(
      demoEnvironment(join('run', 'two')).dbPath,
    )
  })
})

describe('realEnvironment', () => {
  it('declares the real mode and carries the paths it was handed', () => {
    const environment = realEnvironment({
      dbPath: 'forge.db',
      worktreeRoot: 'worktrees',
      shotDir: 'shots',
      tokenPath: '.forge-token',
    })

    expect(environment).toEqual({
      mode: 'real',
      dbPath: 'forge.db',
      worktreeRoot: 'worktrees',
      shotDir: 'shots',
      tokenPath: '.forge-token',
    })
  })
})
