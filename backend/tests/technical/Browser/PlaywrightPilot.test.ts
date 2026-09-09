import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createPlaywrightPilot,
  PACE_DELAY,
  TextNotFoundError,
} from '../../../src/technical/Browser/PlaywrightPilot.js'
import type { PilotDriver } from '../../../src/domain/Pilot/Pilot.js'

const PAGE = `<!doctype html>
<html lang="fr"><body>
  <main id="board">Liste des mails</main>
  <input id="subject" />
  <button id="compose" onclick="document.getElementById('board').textContent = 'Nouveau mail'">Composer</button>
  <button id="crash" onclick="undefinedThing()">Casser</button>
</body></html>`

let server: Server
let url: string
let pilot: PilotDriver

beforeAll(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(PAGE)
  })
  await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening))
  const address = server.address()
  url = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}/` : ''
  pilot = createPlaywrightPilot({ shotDir: mkdtempSync(join(tmpdir(), 'forge-shots-')) })
  await pilot.open(url, 'live')
})

afterAll(async () => {
  await pilot.close()
  await new Promise<void>((closed) => server.close(() => closed()))
})

describe('the pace', () => {
  it('slows the browser down so a human can follow', () => {
    expect(PACE_DELAY.slow).toBeGreaterThan(PACE_DELAY.live)
  })

  it('slows it down even more when it is walked step by step', () => {
    expect(PACE_DELAY.step).toBeGreaterThan(PACE_DELAY.slow)
  })
})

describe('a real chromium', () => {
  it('reads what the page says', async () => {
    const seen = await pilot.perform({ kind: 'expectText', target: '#board', value: 'Liste des mails' })

    expect(seen.detail).toContain('Liste des mails')
  })

  it('refuses a text the page does not say', async () => {
    await expect(
      pilot.perform({ kind: 'expectText', target: '#board', value: 'Corbeille' }),
    ).rejects.toThrow(TextNotFoundError)
  })

  it('takes a screenshot of every step, that is the evidence', async () => {
    const seen = await pilot.perform({ kind: 'screenshot' })

    expect(seen.screenshotPath).toMatch(/\.png$/)
  })

  it('writes in a field', async () => {
    await pilot.perform({ kind: 'fill', target: '#subject', value: 'Bonjour' })

    expect(await pilot.perform({ kind: 'screenshot' })).toBeDefined()
  })

  it('clicks, and the page changes under it', async () => {
    await pilot.perform({ kind: 'click', target: '#compose' })
    const seen = await pilot.perform({ kind: 'expectText', target: '#board', value: 'Nouveau mail' })

    expect(seen.detail).toContain('Nouveau mail')
  })

  it('brings back the errors the page logged', async () => {
    const seen = await pilot.perform({ kind: 'click', target: '#crash' })

    expect(seen.consoleErrors.join(' ')).toContain('undefinedThing')
  })

  it('forgets the errors it has already reported', async () => {
    await pilot.perform({ kind: 'click', target: '#crash' })

    expect((await pilot.perform({ kind: 'screenshot' })).consoleErrors).toEqual([])
  })

  it('goes to another page when it is told to', async () => {
    const seen = await pilot.perform({ kind: 'goto', target: url })

    expect(seen.detail).toContain(url)
  })

  it('says where it is and what it reads when it is inspected', async () => {
    const seen = await pilot.inspect()

    expect(seen.detail).toContain('Liste des mails')
  })
})
