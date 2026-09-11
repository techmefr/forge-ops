import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32

export const BROWSER_SESSION_LIFETIME_MS = 1000 * 60 * 60 * 12

const DEFAULT_CAP = 64

export type BrowserSession = {
  token: string
  expiresAt: number
}

export type BrowserSessions = {
  open: () => BrowserSession
  isOpen: (token: string) => boolean
  close: (token: string) => void
  count: () => number
}

export type BrowserSessionsInput = {
  lifetimeMs?: number
  cap?: number
  clock?: () => number
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createBrowserSessions({
  lifetimeMs = BROWSER_SESSION_LIFETIME_MS,
  cap = DEFAULT_CAP,
  clock = Date.now,
}: BrowserSessionsInput = {}): BrowserSessions {
  const expiries = new Map<string, number>()

  function discardExpired(): void {
    const now = clock()
    for (const [key, expiresAt] of expiries) {
      if (expiresAt <= now) {
        expiries.delete(key)
      }
    }
  }

  function makeRoom(): void {
    discardExpired()
    while (expiries.size >= cap) {
      const oldest = expiries.keys().next()
      if (oldest.done === true) {
        return
      }
      expiries.delete(oldest.value)
    }
  }

  return {
    open: () => {
      makeRoom()
      const token = randomBytes(TOKEN_BYTES).toString('hex')
      const expiresAt = clock() + lifetimeMs
      expiries.set(digest(token), expiresAt)
      return { token, expiresAt }
    },

    isOpen: (token) => {
      const expiresAt = expiries.get(digest(token))
      if (expiresAt === undefined) {
        return false
      }
      if (expiresAt <= clock()) {
        expiries.delete(digest(token))
        return false
      }
      return true
    },

    close: (token) => {
      expiries.delete(digest(token))
    },

    count: () => {
      discardExpired()
      return expiries.size
    },
  }
}
