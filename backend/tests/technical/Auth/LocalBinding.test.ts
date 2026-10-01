import { describe, expect, it } from 'vitest'
import { assertLocalModeBinding } from '../../../src/technical/Auth/LocalBinding.js'

describe('assertLocalModeBinding', () => {
  it('accepts the loopback in local mode', () => {
    expect(() => assertLocalModeBinding('local', '127.0.0.1', undefined)).not.toThrow()
  })

  it('refuses a non-loopback host in local mode', () => {
    expect(() => assertLocalModeBinding('local', '0.0.0.0', undefined)).toThrow(/refuses to listen/)
  })

  it('accepts a non-loopback host in local mode when the override is set', () => {
    expect(() => assertLocalModeBinding('local', '0.0.0.0', 'true')).not.toThrow()
  })

  it('ignores any other value of the override', () => {
    expect(() => assertLocalModeBinding('local', '0.0.0.0', '1')).toThrow(/refuses to listen/)
  })

  it('does not restrict hub mode', () => {
    expect(() => assertLocalModeBinding('hub', '0.0.0.0', undefined)).not.toThrow()
  })
})
