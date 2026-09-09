import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SHOT_NAME = /^pilot-\d+-\d+\.png$/

export type PilotShotApiInput = {
  shotDir: string
  read?: (path: string) => Buffer
}

export function createPilotShotApi({ shotDir, read = readFileSync }: PilotShotApiInput): Hono {
  const api = new Hono()

  api.get('/api/pilots/shots/:name', (context) => {
    const name = context.req.param('name')
    if (!SHOT_NAME.test(name)) {
      return context.json({ error: 'UnknownScreenshot' }, 404)
    }
    try {
      const bytes = new Uint8Array(read(join(shotDir, name)))
      return context.body(bytes, 200, { 'content-type': 'image/png' })
    } catch {
      return context.json({ error: 'UnknownScreenshot' }, 404)
    }
  })

  return api
}
