import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const compose = readFileSync(resolve(process.cwd(), 'docker', 'compose.laptop.yml'), 'utf8')

describe('docker/compose.laptop.yml', () => {
  const published = [...compose.matchAll(/^\s+-\s+'([^']*\d+:\d+)'\s*$/gm)].map((match) => match[1] ?? '')

  it('publishes ports', () => {
    expect(published.length).toBeGreaterThan(0)
  })

  it.each(published)('binds %s to the loopback only', (mapping) => {
    expect(mapping.startsWith('127.0.0.1:')).toBe(true)
  })
})
