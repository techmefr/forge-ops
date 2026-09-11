import { describe, expect, it } from 'vitest'
import {
  allowedRerouteHostsOf,
  assertRerouteBaseUrl,
  DEFAULT_ALLOWED_REROUTE_HOSTS,
  RerouteHostRefusedError,
} from '../../../src/domain/Budget/RerouteHost.js'

describe('assertRerouteBaseUrl', () => {
  it('accepts a host on the allow-list', () => {
    expect(assertRerouteBaseUrl('https://api.anthropic.com', DEFAULT_ALLOWED_REROUTE_HOSTS)).toBe(
      'https://api.anthropic.com',
    )
  })

  it('accepts a path under an allowed host', () => {
    expect(assertRerouteBaseUrl('https://api.anthropic.com/v1', DEFAULT_ALLOWED_REROUTE_HOSTS)).toBe(
      'https://api.anthropic.com/v1',
    )
  })

  it('refuses a host absent from the allow-list', () => {
    expect(() => assertRerouteBaseUrl('https://probe.invalid', DEFAULT_ALLOWED_REROUTE_HOSTS)).toThrow(
      RerouteHostRefusedError,
    )
  })

  it('refuses a host that merely ends with an allowed host', () => {
    expect(() => assertRerouteBaseUrl('https://api.anthropic.com.probe.invalid', DEFAULT_ALLOWED_REROUTE_HOSTS)).toThrow(
      RerouteHostRefusedError,
    )
  })

  it('refuses credentials carried in the authority', () => {
    expect(() => assertRerouteBaseUrl('https://probe:probe@api.anthropic.com', DEFAULT_ALLOWED_REROUTE_HOSTS)).toThrow(
      RerouteHostRefusedError,
    )
  })

  it('refuses a plaintext scheme', () => {
    expect(() => assertRerouteBaseUrl('http://api.anthropic.com', DEFAULT_ALLOWED_REROUTE_HOSTS)).toThrow(
      RerouteHostRefusedError,
    )
  })

  it('refuses an unparsable url', () => {
    expect(() => assertRerouteBaseUrl('https://', DEFAULT_ALLOWED_REROUTE_HOSTS)).toThrow(RerouteHostRefusedError)
  })

  it('refuses everything when the allow-list is empty', () => {
    expect(() => assertRerouteBaseUrl('https://api.anthropic.com', [])).toThrow(RerouteHostRefusedError)
  })

  it('names what was refused and why', () => {
    try {
      assertRerouteBaseUrl('https://probe.invalid', DEFAULT_ALLOWED_REROUTE_HOSTS)
      expect.unreachable('an unlisted host is not a router')
    } catch (error) {
      expect(error).toBeInstanceOf(RerouteHostRefusedError)
      expect((error as RerouteHostRefusedError).message).toContain('probe.invalid')
    }
  })
})

describe('allowedRerouteHostsOf', () => {
  it('falls back to the built-in list when nothing is declared', () => {
    expect(allowedRerouteHostsOf(undefined)).toEqual(DEFAULT_ALLOWED_REROUTE_HOSTS)
  })

  it('reads a comma separated declaration', () => {
    expect(allowedRerouteHostsOf('gateway.probe.invalid, api.anthropic.com')).toEqual([
      'gateway.probe.invalid',
      'api.anthropic.com',
    ])
  })

  it('drops blank entries', () => {
    expect(allowedRerouteHostsOf('gateway.probe.invalid,,')).toEqual(['gateway.probe.invalid'])
  })
})
