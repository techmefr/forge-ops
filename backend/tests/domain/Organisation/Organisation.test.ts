import { describe, expect, it } from 'vitest'
import {
  belongsTo,
  keptFor,
  providerRefusalOf,
  tokenIsLive,
  waysIn,
} from '../../../src/domain/Organisation/Organisation.js'
import type { AuthProvider, InstanceToken } from '../../../src/domain/Organisation/Organisation.js'

function provider(
  kind: AuthProvider['kind'],
  enabled: boolean,
  issuer: string | null = null,
  clientId: string | null = null,
): AuthProvider {
  return { kind, enabled, issuer, clientId }
}

function token(revokedAt: string | null): InstanceToken {
  return {
    id: 1,
    organisationId: 1,
    name: 'le vps',
    createdAt: '2026-09-01T09:00:00Z',
    lastSeenAt: null,
    revokedAt,
  }
}

describe('declaring a way in', () => {
  it('refuses a provider the tool does not know', () => {
    expect(providerRefusalOf({ kind: 'carrier pigeon', enabled: true, issuer: null, clientId: null }, [])).toBe(
      'UnknownProvider',
    )
  })

  it('asks an issuer and a client of the ones that federate', () => {
    expect(providerRefusalOf({ kind: 'microsoft', enabled: true, issuer: null, clientId: 'x' }, [])).toBe(
      'MissingIssuer',
    )
    expect(
      providerRefusalOf({ kind: 'google', enabled: true, issuer: 'https://accounts.google.com', clientId: null }, []),
    ).toBe('MissingClientId')
  })

  it('asks nothing of a password', () => {
    expect(providerRefusalOf({ kind: 'password', enabled: true, issuer: null, clientId: null }, [])).toBeNull()
  })

  it('accepts a federated provider that carries both', () => {
    expect(
      providerRefusalOf(
        { kind: 'microsoft', enabled: true, issuer: 'https://login.microsoftonline.com/x', clientId: 'abc' },
        [],
      ),
    ).toBeNull()
  })

  it('never closes the last way in', () => {
    expect(
      providerRefusalOf({ kind: 'password', enabled: false, issuer: null, clientId: null }, [
        provider('password', true),
      ]),
    ).toBe('LastWayIn')
    expect(
      providerRefusalOf({ kind: 'password', enabled: false, issuer: null, clientId: null }, [
        provider('password', true),
        provider('microsoft', true, 'https://issuer', 'abc'),
      ]),
    ).toBeNull()
  })
})

describe('the ways in of an organisation', () => {
  it('keeps the order the roadmap settled: password, microsoft, google, then the magic link', () => {
    expect(
      waysIn([
        provider('magicLink', true),
        provider('google', true),
        provider('password', true),
        provider('microsoft', true),
      ]),
    ).toEqual(['password', 'microsoft', 'google', 'magicLink'])
  })

  it('leaves out what is declared but switched off', () => {
    expect(waysIn([provider('password', true), provider('google', false)])).toEqual(['password'])
  })
})

describe('an instance that proves who it belongs to', () => {
  it('lives until it is revoked', () => {
    expect(tokenIsLive(token(null))).toBe(true)
    expect(tokenIsLive(token('2026-09-02T09:00:00Z'))).toBe(false)
  })
})

describe('what a shared row carries', () => {
  it('belongs to one organisation', () => {
    expect(belongsTo({ organisationId: 1 }, 1)).toBe(true)
    expect(belongsTo({ organisationId: 2 }, 1)).toBe(false)
  })

  it('keeps only the rows of the organisation asking', () => {
    expect(keptFor([{ organisationId: 1 }, { organisationId: 2 }, { organisationId: 1 }], 1)).toHaveLength(2)
  })
})
