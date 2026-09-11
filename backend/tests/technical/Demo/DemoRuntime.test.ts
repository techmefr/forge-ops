import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  demoAccessLines,
  demoBoardUrl,
  discardDemoDatabase,
  inspectDemoBundle,
} from '../../../src/technical/Demo/DemoRuntime.js'

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'forge-demo-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('discardDemoDatabase', () => {
  it('removes a stale database and its write-ahead files', () => {
    const dbPath = join(home, 'forge-demo.db')
    writeFileSync(dbPath, 'stale')
    writeFileSync(`${dbPath}-wal`, 'stale')
    writeFileSync(`${dbPath}-shm`, 'stale')

    const removed = discardDemoDatabase(dbPath)

    expect(removed).toEqual([dbPath, `${dbPath}-wal`, `${dbPath}-shm`])
    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(`${dbPath}-wal`)).toBe(false)
    expect(existsSync(`${dbPath}-shm`)).toBe(false)
  })

  it('removes nothing when no database is there yet', () => {
    expect(discardDemoDatabase(join(home, 'absente.db'))).toEqual([])
  })
})

describe('inspectDemoBundle', () => {
  it('reports a missing bundle with the directory it looked in', () => {
    const distDir = join(home, 'dist', 'web')

    const bundle = inspectDemoBundle(distDir)

    expect(bundle.built).toBe(false)
    expect(bundle.distDir).toBe(distDir)
    expect(bundle.reason).toContain(distDir)
  })

  it('reports a bundle whose index page is there', () => {
    const distDir = join(home, 'dist', 'web')
    mkdirSync(distDir, { recursive: true })
    writeFileSync(join(distDir, 'index.html'), '<!doctype html>')

    expect(inspectDemoBundle(distDir)).toEqual({ built: true, distDir, reason: null })
  })

  it('reports a directory holding assets but no index page as not built', () => {
    const distDir = join(home, 'dist', 'web')
    mkdirSync(distDir, { recursive: true })
    writeFileSync(join(distDir, 'app.js'), 'console.log(1)')

    expect(inspectDemoBundle(distDir).built).toBe(false)
  })
})

describe('demoAccessLines', () => {
  const token = 'a'.repeat(64)

  it('never puts the token in a url', () => {
    const lines = demoAccessLines({ port: 8899, token })

    const urlLines = lines.filter((line) => line.includes('http://'))
    expect(urlLines.length).toBeGreaterThan(0)
    for (const line of urlLines) {
      expect(line).not.toContain(token)
    }
  })

  it('prints the url to open and the token on separate lines', () => {
    const lines = demoAccessLines({ port: 8899, token })

    expect(lines.some((line) => line.includes('http://127.0.0.1:8899'))).toBe(true)
    expect(lines.some((line) => line.includes(token) && !line.includes('http://'))).toBe(true)
  })

  it('names the bearer header and the cookie as the way in', () => {
    const joined = demoAccessLines({ port: 8899, token }).join('\n')

    expect(joined).toContain('Authorization: Bearer')
    expect(joined).toContain('forge_token')
  })
})

describe('demoBoardUrl', () => {
  it('stays on the loopback and carries no query string', () => {
    const url = demoBoardUrl(8899)

    expect(url).toBe('http://127.0.0.1:8899')
    expect(url).not.toContain('?')
  })
})
