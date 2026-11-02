import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseBody } from '../../../src/technical/Http/ParseBody.js'

const schema = z.object({ name: z.string() })

function appUnderTest(): Hono {
  const app = new Hono()
  app.post('/', async (context) => {
    const body = await parseBody(context, schema)
    return context.json(body.success ? { name: body.data.name } : { refused: true })
  })
  return app
}

describe('parseBody', () => {
  it('returns the typed data of a valid body', async () => {
    const response = await appUnderTest().request('/', { method: 'POST', body: JSON.stringify({ name: 'a' }), headers: { 'content-type': 'application/json' } })
    expect(await response.json()).toEqual({ name: 'a' })
  })

  it('refuses a body that does not match the schema', async () => {
    const response = await appUnderTest().request('/', { method: 'POST', body: JSON.stringify({ name: 1 }), headers: { 'content-type': 'application/json' } })
    expect(await response.json()).toEqual({ refused: true })
  })

  it('refuses malformed JSON instead of throwing', async () => {
    const response = await appUnderTest().request('/', { method: 'POST', body: '{nope', headers: { 'content-type': 'application/json' } })
    expect(await response.json()).toEqual({ refused: true })
  })
})
