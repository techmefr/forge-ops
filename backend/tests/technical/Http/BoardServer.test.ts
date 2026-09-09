import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultBoardServerInput,
  startBoardServer,
  type BoardServer,
} from '../../../src/technical/Http/BoardServer.js'

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
    board = await startBoardServer({ port: 0, dbPath: ':memory:', claudeHome, host: '127.0.0.1' })

    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ roster: null, jobs: [] })
  })

  it('binds the loopback interface by default, never every interface', () => {
    expect(defaultBoardServerInput().host).toBe('127.0.0.1')
  })

  it('answers on the loopback address it claims to bind', async () => {
    claudeHome = mkdtempSync(join(tmpdir(), 'starfleet-claude-home-'))
    board = await startBoardServer({ port: 0, dbPath: ':memory:', claudeHome, host: '127.0.0.1' })

    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`)

    expect(response.status).toBe(200)
  })
})
