import { describe, expect, it } from 'vitest'
import { assertConfinedPath, isConfinedPath, ConfinedPathRefusedError } from '../../../src/domain/File/ConfinedPath.js'

describe('assertConfinedPath', () => {
  it('accepts a path inside the checkout', () => {
    expect(assertConfinedPath('src/domain/Story/Story.ts')).toBe('src/domain/Story/Story.ts')
  })

  it('trims the surrounding whitespace', () => {
    expect(assertConfinedPath('  src/domain/Story/Story.ts  ')).toBe('src/domain/Story/Story.ts')
  })

  it('refuses an absolute path', () => {
    expect(() => assertConfinedPath('/nonexistent-probe-target/victim.ts')).toThrow(ConfinedPathRefusedError)
  })

  it('refuses a path climbing above the checkout', () => {
    expect(() => assertConfinedPath('src/../../nonexistent-probe-target/victim.ts')).toThrow(
      ConfinedPathRefusedError,
    )
  })

  it('refuses a backslash path', () => {
    expect(() => assertConfinedPath('C:\\nonexistent-probe-target\\victim.ts')).toThrow(ConfinedPathRefusedError)
  })

  it('refuses a null byte', () => {
    expect(() => assertConfinedPath(`src/Story.ts${String.fromCharCode(0)}`)).toThrow(ConfinedPathRefusedError)
  })

  it('refuses an empty path', () => {
    expect(() => assertConfinedPath('   ')).toThrow(ConfinedPathRefusedError)
  })

  it('refuses a directory', () => {
    expect(() => assertConfinedPath('src/domain/')).toThrow(ConfinedPathRefusedError)
  })
})

describe('isConfinedPath', () => {
  it('answers true inside the checkout', () => {
    expect(isConfinedPath('src/domain/Story/Story.ts')).toBe(true)
  })

  it('answers false outside the checkout', () => {
    expect(isConfinedPath('/nonexistent-probe-target/victim.ts')).toBe(false)
  })
})
