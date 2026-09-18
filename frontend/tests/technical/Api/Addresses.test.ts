import { describe, expect, it } from 'vitest'
import { addressesOf, SAME_ORIGIN } from '@/technical/Api/Addresses'

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
