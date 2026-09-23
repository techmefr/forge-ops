import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { BrowserSessions } from '../Auth/BrowserSession.js'
import { BOARD_COOKIE, LOCAL_SESSION_PATH, sameSecret, SESSION_EXCHANGE_PATH } from '../Auth/TokenGuard.js'

const exchangeSchema = z.object({
  token: z.string().min(1).max(256),
})

export type SessionApiInput = {
  token: string
  sessions: BrowserSessions
}

export function createSessionApi({ token, sessions }: SessionApiInput): Hono {
  const api = new Hono()

  api.post(SESSION_EXCHANGE_PATH, async (context) => {
    const offered = exchangeSchema.safeParse(await context.req.json().catch(() => null))
    if (!offered.success) {
      return context.json({ error: 'InvalidSessionRequest' }, 422)
    }
    if (!sameSecret(offered.data.token, token)) {
      return context.json({ error: 'UnauthorizedSessionRequest' }, 401)
    }
    const opened = sessions.open()
    setCookie(context, BOARD_COOKIE, opened.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      expires: new Date(opened.expiresAt),
    })
    return context.json({ expiresAt: new Date(opened.expiresAt).toISOString() }, 201)
  })

  api.post(LOCAL_SESSION_PATH, (context) => {
    const opened = sessions.open()
    setCookie(context, BOARD_COOKIE, opened.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      expires: new Date(opened.expiresAt),
    })
    return context.json({ expiresAt: new Date(opened.expiresAt).toISOString() }, 201)
  })

  api.delete(SESSION_EXCHANGE_PATH, (context) => {
    const held = getCookie(context, BOARD_COOKIE)
    if (held !== undefined) {
      sessions.close(held)
    }
    deleteCookie(context, BOARD_COOKIE, { path: '/' })
    return context.json({ closed: true })
  })

  return api
}
