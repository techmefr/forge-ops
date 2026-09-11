import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertCheckoutPath, CheckoutPathRefusedError } from '../../../src/domain/Story/CheckoutPath.js'

const ROOTS = ['/workspaces/forge', '/workspaces/worktrees']

describe('assertCheckoutPath', () => {
  it('keeps a path sitting under an allowed root', () => {
    expect(assertCheckoutPath(join('/workspaces/forge', 'backend'), ROOTS)).toBe('/workspaces/forge/backend')
  })

  it('keeps an allowed root itself', () => {
    expect(assertCheckoutPath('/workspaces/worktrees', ROOTS)).toBe('/workspaces/worktrees')
  })

  it('refuses a path outside every allowed root', () => {
    expect(() => assertCheckoutPath('/etc', ROOTS)).toThrow(CheckoutPathRefusedError)
  })

  it('refuses a path that climbs back out of an allowed root', () => {
    expect(() => assertCheckoutPath('/workspaces/forge/../../etc', ROOTS)).toThrow(CheckoutPathRefusedError)
  })

  it('refuses a sibling root sharing the same prefix', () => {
    expect(() => assertCheckoutPath('/workspaces/forge-secrets', ROOTS)).toThrow(CheckoutPathRefusedError)
  })

  it('refuses a relative path', () => {
    expect(() => assertCheckoutPath('backend', ROOTS)).toThrow(CheckoutPathRefusedError)
  })

  it('refuses an empty path', () => {
    expect(() => assertCheckoutPath('   ', ROOTS)).toThrow(CheckoutPathRefusedError)
  })
})
