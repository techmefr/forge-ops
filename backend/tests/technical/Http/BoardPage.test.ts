import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { createBoardPage } from '../../../src/technical/Http/BoardPage.js'

const TOKEN = 'a'.repeat(64)

let home: string
let distDir: string
let page: Hono

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'starfleet-front-'))
  writeFileSync(join(home, 'secret.json'), '{"token":"vole"}')
  distDir = join(home, 'dist')
  mkdirSync(join(distDir, 'assets'), { recursive: true })
  writeFileSync(join(distDir, 'index.html'), '<div id="board"></div>')
  writeFileSync(join(distDir, 'assets', 'board.js'), 'export const board = 1')
  page = createBoardPage({ token: TOKEN, distDir })
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('createBoardPage', () => {
  it('serves the board page', async () => {
    const response = await page.request('/')

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toContain('id="board"')
  })

  it('hands the browser the board token as a cookie it cannot read', async () => {
    const response = await page.request('/')

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`forge_token=${TOKEN}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
  })

  it('never lets the token reach the page body, where a script could read it', async () => {
    const response = await page.request('/')

    await expect(response.text()).resolves.not.toContain(TOKEN)
  })

  it('serves an asset without handing out the token again', async () => {
    const response = await page.request('/assets/board.js')

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(null)
  })

  it('falls back on the page for a route owned by the router', async () => {
    const response = await page.request('/backlog')

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toContain('id="board"')
  })

  it('answers a missing asset with a not found, never with the page', async () => {
    const response = await page.request('/assets/absent.js')

    expect(response.status).toBe(404)
  })

  it('never hands out a file outside the built front', async () => {
    const response = await page.request('/assets/../../../../etc/passwd')

    await expect(response.text()).resolves.not.toContain('root:')
  })

  it('refuses a traversal that survives the url normalisation', async () => {
    const response = await page.request('/assets/%2e%2e%2f%2e%2e%2fsecret.json')

    expect(response.status).toBe(404)
    await expect(response.text()).resolves.not.toContain('vole')
  })

  it('says the front is not built when the page is missing', async () => {
    rmSync(join(distDir, 'index.html'))

    const response = await page.request('/')

    expect(response.status).toBe(503)
    expect(response.headers.get('set-cookie')).toBe(null)
  })
})
