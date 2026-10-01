import { randomBytes } from 'node:crypto'
import { OIDC_STORE_CAP } from './OidcTransactions.js'

const HANDOFF_LIFETIME_MS = 60 * 1000
const CODE_BYTES = 24

export type OidcHandoffs<Payload> = {
  put: (payload: Payload) => string
  take: (code: string) => Payload | null
}

export function createOidcHandoffs<Payload>(
  clock: () => number = Date.now,
  cap: number = OIDC_STORE_CAP,
): OidcHandoffs<Payload> {
  const waiting = new Map<string, { payload: Payload; expiresAt: number }>()

  function makeRoom(): void {
    if (waiting.size < cap) {
      return
    }
    for (const [code, entry] of waiting) {
      if (entry.expiresAt <= clock()) {
        waiting.delete(code)
      }
    }
    while (waiting.size >= cap) {
      const oldest = waiting.keys().next()
      if (oldest.done === true) {
        return
      }
      waiting.delete(oldest.value)
    }
  }

  return {
    put: (payload) => {
      makeRoom()
      const code = randomBytes(CODE_BYTES).toString('base64url')
      waiting.set(code, { payload, expiresAt: clock() + HANDOFF_LIFETIME_MS })
      return code
    },
    take: (code) => {
      const entry = waiting.get(code)
      waiting.delete(code)
      return entry === undefined || entry.expiresAt <= clock() ? null : entry.payload
    },
  }
}
