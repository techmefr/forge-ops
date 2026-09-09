import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { createPilotShotApi } from '../../../src/technical/Http/PilotShotApi.js'

let api: Hono
let shotDir: string

beforeEach(() => {
  shotDir = mkdtempSync(join(tmpdir(), 'forge-shots-'))
  writeFileSync(join(shotDir, 'pilot-1-1.png'), Buffer.from([137, 80, 78, 71]))
  writeFileSync(join(shotDir, 'secret.txt'), 'mot de passe')
  api = createPilotShotApi({ shotDir })
})

function read(name: string): Promise<Response> {
  return api.request(`/api/pilots/shots/${name}`) as Promise<Response>
}

describe('GET /api/pilots/shots/:name', () => {
  it('serves the screenshot the pilot took', async () => {
    const response = await read('pilot-1-1.png')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
  })

  it('rends the bytes of the file, not its name', async () => {
    const response = await read('pilot-1-1.png')

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]))
  })

  it('refuses a screenshot that does not exist', async () => {
    expect((await read('pilot-9-9.png')).status).toBe(404)
  })

  it('refuses anything that is not a screenshot it took', async () => {
    expect((await read('secret.txt')).status).toBe(404)
  })

  it('refuses to climb out of its own folder', async () => {
    expect((await read('..%2f..%2fetc%2fpasswd')).status).toBe(404)
  })

  it('refuses a name that only hides a screenshot name inside it', async () => {
    writeFileSync(join(shotDir, 'x-pilot-1-1.png.txt'), 'mot de passe')

    expect((await read('x-pilot-1-1.png.txt')).status).toBe(404)
  })

  it('refuses a name with a slash in it', async () => {
    expect((await read('sub%2fpilot-1-1.png')).status).toBe(404)
  })
})
