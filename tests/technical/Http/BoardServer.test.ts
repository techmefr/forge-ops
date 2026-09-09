import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startBoardServer, type BoardServer } from '../../../src/technical/Http/BoardServer.js'

let board: BoardServer | null = null
let claudeHome: string

afterEach(async () => {
  await board?.close()
  board = null
  rmSync(claudeHome, { recursive: true, force: true })
})

describe('startBoardServer', () => {
  it('boots on a free port and answers the fleet route', async () => {
    claudeHome = mkdtempSync(join(tmpdir(), 'starfleet-claude-home-'))
    board = await startBoardServer({ port: 0, dbPath: ':memory:', claudeHome })

    const response = await fetch(`http://localhost:${board.port}/api/fleet`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ roster: null, jobs: [] })
  })
})
