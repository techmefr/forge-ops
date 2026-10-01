import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { installedVersion, offeredVersion, PACKAGE_VERSION } from '../../../src/technical/Version/ForgeVersion.js'

const manifest = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }

afterEach(() => {
  delete process.env.FORGE_VERSION
  delete process.env.FORGE_OFFERED_VERSION
})

describe('the version Forge reports', () => {
  it('matches the version of package.json', () => {
    expect(PACKAGE_VERSION).toBe(manifest.version)
    expect(installedVersion()).toBe(manifest.version)
  })

  it('lets FORGE_VERSION override the installed version', () => {
    process.env.FORGE_VERSION = '9.9.9'

    expect(installedVersion()).toBe('9.9.9')
    expect(offeredVersion()).toBe('9.9.9')
  })

  it('offers the installed version unless a newer one is announced', () => {
    expect(offeredVersion()).toBe(manifest.version)

    process.env.FORGE_OFFERED_VERSION = '1.2.3'

    expect(offeredVersion()).toBe('1.2.3')
  })
})
