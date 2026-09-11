import { describe, expect, it } from 'vitest'
import { assertTouchedPath, TouchedPathRefusedError } from '../../../src/domain/Agent/TouchedPath.js'

describe('assertTouchedPath', () => {
  it('keeps a plain relative path', () => {
    expect(assertTouchedPath('backend/src/forge.ts')).toBe('backend/src/forge.ts')
  })

  it('keeps an absolute path as the hook reports it', () => {
    expect(assertTouchedPath('/workspaces/forge/backend/src/forge.ts')).toBe(
      '/workspaces/forge/backend/src/forge.ts',
    )
  })

  it('collapses the noise so one file lands on one row', () => {
    expect(assertTouchedPath('backend//src/./api/../forge.ts')).toBe('backend/src/forge.ts')
  })

  it('refuses a path that climbs above the root', () => {
    expect(() => assertTouchedPath('../../etc/shadow')).toThrow(TouchedPathRefusedError)
  })

  it('refuses a path carrying a null byte', () => {
    expect(() => assertTouchedPath(`forge.ts${String.fromCharCode(0)}`)).toThrow(TouchedPathRefusedError)
  })

  it('refuses an empty path', () => {
    expect(() => assertTouchedPath('   ')).toThrow(TouchedPathRefusedError)
  })

  it('refuses a path longer than the cap', () => {
    expect(() => assertTouchedPath('a'.repeat(4097))).toThrow(TouchedPathRefusedError)
  })
})
