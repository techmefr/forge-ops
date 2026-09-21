import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { markDemoDatabase } from '../../../src/technical/Demo/DemoMark.js'
import {
  createDemoRunRoot,
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

function writeMarkedDatabase(dbPath: string): void {
  const db = new Database(dbPath)
  markDemoDatabase(db)
  db.close()
}

function writeUnmarkedDatabase(dbPath: string): void {
  const db = new Database(dbPath)
  db.exec('CREATE TABLE board_setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  db.close()
}

describe('discardDemoDatabase', () => {
  it('refuses to delete a database that carries no demo mark, and leaves it there', () => {
    const dbPath = join(home, 'real.db')
    writeUnmarkedDatabase(dbPath)
    writeFileSync(`${dbPath}-wal`, 'ahead')

    const discard = discardDemoDatabase(dbPath)

    expect(discard.removed).toEqual([])
    expect(discard.refused).toContain(dbPath)
    expect(existsSync(dbPath)).toBe(true)
    expect(existsSync(`${dbPath}-wal`)).toBe(true)
  })

  it('refuses to delete a file that is not a database at all', () => {
    const dbPath = join(home, 'notes.db')
    writeFileSync(dbPath, 'not a database')

    const discard = discardDemoDatabase(dbPath)

    expect(discard.removed).toEqual([])
    expect(discard.refused).not.toBeNull()
    expect(existsSync(dbPath)).toBe(true)
  })

  it('removes a marked database and its write-ahead files', () => {
    const dbPath = join(home, 'forge-demo.db')
    writeMarkedDatabase(dbPath)
    writeFileSync(`${dbPath}-wal`, 'stale')
    writeFileSync(`${dbPath}-shm`, 'stale')

    const discard = discardDemoDatabase(dbPath)

    expect(discard.refused).toBeNull()
    expect(discard.removed).toEqual([dbPath, `${dbPath}-wal`, `${dbPath}-shm`])
    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(`${dbPath}-wal`)).toBe(false)
    expect(existsSync(`${dbPath}-shm`)).toBe(false)
  })

  it('removes nothing when no database is there yet', () => {
    const discard = discardDemoDatabase(join(home, 'absente.db'))

    expect(discard.removed).toEqual([])
    expect(discard.refused).toBeNull()
  })
})

describe('createDemoRunRoot', () => {
  it('makes a fresh directory of its own for each run', () => {
    const first = createDemoRunRoot()
    const second = createDemoRunRoot()
    try {
      expect(first).not.toBe(second)
      expect(existsSync(first)).toBe(true)
      expect(existsSync(second)).toBe(true)
    } finally {
      rmSync(first, { recursive: true, force: true })
      rmSync(second, { recursive: true, force: true })
    }
  })

  it('starts a run with no database in it', () => {
    const runRoot = createDemoRunRoot()
    try {
      expect(existsSync(join(runRoot, 'forge-demo.db'))).toBe(false)
    } finally {
      rmSync(runRoot, { recursive: true, force: true })
    }
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

    expect(lines.some((line) => line.includes('http://forge.localhost:8899'))).toBe(true)
    expect(lines.some((line) => line.includes(token) && !line.includes('http://'))).toBe(true)
  })

  it('names the bearer header and the cookie as the way in', () => {
    const joined = demoAccessLines({ port: 8899, token }).join('\n')

    expect(joined).toContain('Authorization: Bearer')
    expect(joined).toContain('forge_token')
  })

  it('tells the human to paste the token, since opening the page alone hands out nothing', () => {
    const joined = demoAccessLines({ port: 8899, token }).join('\n')

    expect(joined).toContain('coller le jeton')
  })
})

describe('demoBoardUrl', () => {
  it('stays on the loopback, under the friendly dev name, and carries no query string', () => {
    const url = demoBoardUrl(8899)

    expect(url).toBe('http://forge.localhost:8899')
    expect(url).not.toContain('?')
  })
})
