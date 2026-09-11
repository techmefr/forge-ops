import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertTouchedPath, TouchedPathRefusedError } from '../../../src/domain/Agent/TouchedPath.js'

const ROOTS = ['/workspaces/forge', '/workspaces/worktrees']

describe('assertTouchedPath', () => {
  it('keeps a plain relative path', () => {
    expect(assertTouchedPath('backend/src/forge.ts', ROOTS)).toBe('backend/src/forge.ts')
  })

  it('relativises an absolute path the hook reports from inside a root', () => {
    expect(assertTouchedPath(join('/workspaces/forge', 'backend/src/forge.ts'), ROOTS)).toBe(
      'backend/src/forge.ts',
    )
  })

  it('relativises against the worktree root too', () => {
    expect(assertTouchedPath('/workspaces/worktrees/story-12/src/forge.ts', ROOTS)).toBe(
      'story-12/src/forge.ts',
    )
  })

  it('collapses the noise so one file lands on one row', () => {
    expect(assertTouchedPath('backend//src/./api/../forge.ts', ROOTS)).toBe('backend/src/forge.ts')
  })

  it('refuses an absolute path outside every root', () => {
    expect(() => assertTouchedPath('/etc/hosts', ROOTS)).toThrow(TouchedPathRefusedError)
  })

  it('refuses a sibling root sharing the same prefix', () => {
    expect(() => assertTouchedPath('/workspaces/forge-secrets/key.ts', ROOTS)).toThrow(
      TouchedPathRefusedError,
    )
  })

  it('refuses a relative path that climbs above the root', () => {
    expect(() => assertTouchedPath('../../etc/shadow', ROOTS)).toThrow(TouchedPathRefusedError)
  })

  it('refuses a path carrying a null byte', () => {
    expect(() => assertTouchedPath(`forge.ts${String.fromCharCode(0)}`, ROOTS)).toThrow(
      TouchedPathRefusedError,
    )
  })

  it('refuses an empty path', () => {
    expect(() => assertTouchedPath('   ', ROOTS)).toThrow(TouchedPathRefusedError)
  })

  it('refuses a path longer than the cap', () => {
    expect(() => assertTouchedPath('a'.repeat(4097), ROOTS)).toThrow(TouchedPathRefusedError)
  })
})
