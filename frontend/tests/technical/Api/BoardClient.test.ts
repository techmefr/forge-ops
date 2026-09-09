import { describe, expect, it, vi } from 'vitest'
import { BoardRequestError, createBoardClient } from '../../../src/technical/Api/BoardClient.js'

function fetcherReturning(status: number, body: unknown, capture?: RequestInit[]): typeof fetch {
  return ((path: string, init: RequestInit) => {
    capture?.push(init)
    return Promise.resolve(
      new Response(body === undefined ? '' : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }) as unknown as typeof fetch
}

describe('read', () => {
  it('rend le corps decode', async () => {
    const client = createBoardClient({ fetcher: fetcherReturning(200, { slug: 'forge' }) })

    await expect(client.read('/api/projects')).resolves.toEqual({ slug: 'forge' })
  })

  it('envoie le cookie de session, sinon la garde refuse tout', async () => {
    const calls: RequestInit[] = []
    const client = createBoardClient({ fetcher: fetcherReturning(200, {}, calls) })

    await client.read('/api/projects')

    expect(calls[0]?.credentials).toBe('same-origin')
  })

  it('leve un refus lisible sur une erreur du board', async () => {
    const client = createBoardClient({
      fetcher: fetcherReturning(409, { error: 'TwinRequiredError', message: 'il manque la jumelle' }),
    })

    await expect(client.read('/api/x')).rejects.toBeInstanceOf(BoardRequestError)
  })

  it('garde le code du refus, pour que l ecran sache quoi dire', async () => {
    const client = createBoardClient({
      fetcher: fetcherReturning(409, { error: 'TwinRequiredError', message: 'il manque la jumelle' }),
    })

    await expect(client.read('/api/x')).rejects.toMatchObject({
      status: 409,
      code: 'TwinRequiredError',
      message: 'il manque la jumelle',
    })
  })

  it('ne casse pas sur une erreur sans corps json', async () => {
    const client = createBoardClient({ fetcher: fetcherReturning(500, undefined) })

    await expect(client.read('/api/x')).rejects.toMatchObject({ code: 'Http500' })
  })

  it('rend nul sur un corps vide en succes', async () => {
    const client = createBoardClient({ fetcher: fetcherReturning(200, undefined) })

    await expect(client.read('/api/x')).resolves.toBeNull()
  })
})

describe('send', () => {
  it('pose le type de contenu quand il y a un corps', async () => {
    const calls: RequestInit[] = []
    const client = createBoardClient({ fetcher: fetcherReturning(201, {}, calls) })

    await client.send('/api/projects', 'POST', { slug: 'forge' })

    expect(calls[0]?.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(calls[0]?.body).toBe('{"slug":"forge"}')
  })

  it('ne pose pas de type de contenu quand il n y a pas de corps', async () => {
    const calls: RequestInit[] = []
    const client = createBoardClient({ fetcher: fetcherReturning(200, {}, calls) })

    await client.send('/api/auth/logout', 'POST')

    expect(calls[0]?.headers).toEqual({})
    expect(calls[0]?.body).toBeUndefined()
  })

  it('prefixe par la base quand on lui en donne une', async () => {
    const fetcher = vi.fn(
      (_url: string) => Promise.resolve(new Response('{}', { status: 200 })) as unknown as Promise<Response>,
    )
    const client = createBoardClient({ baseUrl: 'http://127.0.0.1:8830', fetcher: fetcher as unknown as typeof fetch })

    await client.read('/api/fleet')

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8830/api/fleet')
  })
})
