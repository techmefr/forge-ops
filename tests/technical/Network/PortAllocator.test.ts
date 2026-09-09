import { describe, expect, it } from 'vitest'
import { allocatePort, allocateSubdomain, DEFAULT_BASE_PORT, DEFAULT_PORT_RANGE } from '../../../src/technical/Network/PortAllocator.js'

describe('allocatePort', () => {
  it('is deterministic for the same branch name', () => {
    const first = allocatePort('feature/login')
    const second = allocatePort('feature/login')
    expect(first).toBe(second)
  })

  it('stays within the configured range', () => {
    const port = allocatePort('feature/login')
    expect(port).toBeGreaterThanOrEqual(DEFAULT_BASE_PORT)
    expect(port).toBeLessThan(DEFAULT_BASE_PORT + DEFAULT_PORT_RANGE)
  })

  it('differs for different branch names in practice', () => {
    const a = allocatePort('feature/login')
    const b = allocatePort('feature/checkout')
    expect(a).not.toBe(b)
  })
})

describe('allocateSubdomain', () => {
  it('slugifies branch names to a safe subdomain', () => {
    expect(allocateSubdomain('feature/Login_V2')).toBe('feature-login-v2')
  })
})
