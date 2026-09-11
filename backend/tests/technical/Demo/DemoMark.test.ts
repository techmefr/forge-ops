import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { carriesDemoMark, markDemoDatabase } from '../../../src/technical/Demo/DemoMark.js'

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'forge-demo-mark-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('carriesDemoMark', () => {
  it('sees the mark a demo run wrote', () => {
    const dbPath = join(home, 'marquee.db')
    const db = new Database(dbPath)
    markDemoDatabase(db)
    db.close()

    expect(carriesDemoMark(dbPath)).toBe(true)
  })

  it('does not see a mark on a board database that was never a demo', () => {
    const dbPath = join(home, 'board.db')
    const db = new Database(dbPath)
    db.exec('CREATE TABLE board_setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.close()

    expect(carriesDemoMark(dbPath)).toBe(false)
  })

  it('does not see a mark on a file that is not a database', () => {
    const dbPath = join(home, 'texte.db')
    writeFileSync(dbPath, 'ceci n est pas une base')

    expect(carriesDemoMark(dbPath)).toBe(false)
  })

  it('does not see a mark on a path with nothing at it', () => {
    expect(carriesDemoMark(join(home, 'absente.db'))).toBe(false)
  })

  it('stays marked when the mark is written twice', () => {
    const dbPath = join(home, 'deux-fois.db')
    const db = new Database(dbPath)
    markDemoDatabase(db)
    markDemoDatabase(db)
    db.close()

    expect(carriesDemoMark(dbPath)).toBe(true)
  })
})
