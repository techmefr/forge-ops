import { describe, expect, it } from 'vitest'
import { workingDirectoryOf } from '../../../src/domain/Dispatch/WorkingDirectory.js'
import { CheckoutMissingError } from '../../../src/domain/Dispatch/DispatchViolation.js'

describe('workingDirectoryOf', () => {
  it('prefers the worktree of the story', () => {
    expect(workingDirectoryOf('/work/hello-1', '/repos/hello', 'Hello')).toBe('/work/hello-1')
  })

  it('falls back to the project checkout', () => {
    expect(workingDirectoryOf(null, '/repos/hello', 'Hello')).toBe('/repos/hello')
  })

  it.each([null, undefined, ''])('refuses to run in the server directory when the checkout is %s', (checkout) => {
    expect(() => workingDirectoryOf(null, checkout, 'Hello')).toThrow(CheckoutMissingError)
  })
})
