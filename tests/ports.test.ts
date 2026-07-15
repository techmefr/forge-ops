import { describe, expect, it } from 'vitest'
import {
  allocatePort,
  allocateSubdomain,
  resolvePort,
  DEFAULT_BASE_PORT,
  DEFAULT_PORT_RANGE,
} from '../src/ports.js'

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

describe('resolvePort', () => {
  it('returns the deterministic port when it is free', () => {
    const expected = allocatePort('feature/login')
    expect(resolvePort('feature/login', new Set())).toBe(expected)
  })

  it('probes to the next free port on collision', () => {
    const deterministic = allocatePort('feature/login')
    const port = resolvePort('feature/login', new Set([deterministic]))
    expect(port).not.toBe(deterministic)
    expect(port).toBeGreaterThanOrEqual(DEFAULT_BASE_PORT)
    expect(port).toBeLessThan(DEFAULT_BASE_PORT + DEFAULT_PORT_RANGE)
  })

  it('gives two projects with the same branch name distinct ports', () => {
    const used = new Set<number>()
    const a = resolvePort('stacktim::main', used)
    used.add(a)
    const b = resolvePort('formation-laravel::main', used)
    expect(a).not.toBe(b)
  })

  it('throws when the whole range is taken', () => {
    const full = new Set<number>()
    for (let p = DEFAULT_BASE_PORT; p < DEFAULT_BASE_PORT + DEFAULT_PORT_RANGE; p += 1) {
      full.add(p)
    }
    expect(() => resolvePort('feature/login', full)).toThrow()
  })
})

describe('allocateSubdomain', () => {
  it('slugifies branch names to a safe subdomain', () => {
    expect(allocateSubdomain('feature/Login_V2')).toBe('feature-login-v2')
  })
})
