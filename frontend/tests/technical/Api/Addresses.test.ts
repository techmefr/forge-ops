import { describe, expect, it } from 'vitest'
import { addressesOf, addressProblemOf, SAME_ORIGIN } from '@/technical/Api/Addresses'

describe('the addresses a built bundle reads at runtime', () => {
  it('falls back to the origin it was served from', () => {
    expect(addressesOf(undefined)).toEqual(SAME_ORIGIN)
    expect(addressesOf(null)).toEqual(SAME_ORIGIN)
    expect(addressesOf({})).toEqual(SAME_ORIGIN)
  })

  it('reads the instance and the server the deployment declared', () => {
    expect(
      addressesOf({ instanceUrl: 'https://instance.example', serverUrl: 'https://server.example' }),
    ).toEqual({ instanceUrl: 'https://instance.example', serverUrl: 'https://server.example' })
  })

  it('drops a trailing slash so a path is never doubled', () => {
    expect(addressesOf({ instanceUrl: 'https://instance.example/' }).instanceUrl).toBe(
      'https://instance.example',
    )
  })

  it('treats an empty address as no address at all', () => {
    expect(addressesOf({ instanceUrl: '   ', serverUrl: '' })).toEqual(SAME_ORIGIN)
  })

  it('ignores an address that is not written as one', () => {
    expect(addressesOf({ instanceUrl: 4311, serverUrl: { host: 'x' } })).toEqual(SAME_ORIGIN)
  })
})

describe('the addresses a saved server may use', () => {
  it('accepts https for any host', () => {
    expect(addressProblemOf('https://forge.example.com')).toBeNull()
    expect(addressProblemOf('  https://forge.example.com:8443/  ')).toBeNull()
  })

  it('accepts plain http for localhost, loopback and private ranges only', () => {
    for (const address of [
      'http://localhost:8830',
      'http://127.0.0.1:8830',
      'http://10.1.2.3',
      'http://172.16.0.1:4311',
      'http://172.31.255.254',
      'http://192.168.1.20:8830',
    ]) {
      expect(addressProblemOf(address)).toBeNull()
    }
  })

  it('refuses plain http for public hosts and lookalikes', () => {
    for (const address of [
      'http://forge.example.com',
      'http://8.8.8.8',
      'http://172.32.0.1',
      'http://172.15.0.1',
      'http://192.169.1.1',
      'http://localhost.evil.com',
      'http://10.0.0.1.evil.com',
      'http://127.0.0.1.evil.com',
    ]) {
      expect(addressProblemOf(address)).toBe('cleartext')
    }
  })

  it('refuses embedded credentials, even on a private host', () => {
    expect(addressProblemOf('https://user:pass@forge.example.com')).toBe('credentials')
    expect(addressProblemOf('http://admin@localhost:8830')).toBe('credentials')
    expect(addressProblemOf('https://forge.example.com@evil.com')).toBe('credentials')
  })

  it('refuses anything that is not an http address', () => {
    for (const address of ['', 'forge.example.com', 'ftp://forge.example.com', 'javascript:alert(1)', 'https://']) {
      expect(addressProblemOf(address)).toBe('scheme')
    }
  })
})
