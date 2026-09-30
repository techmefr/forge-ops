import { randomBytes } from 'node:crypto'
const HANDOFF_LIFETIME_MS = 60 * 1000
const CODE_BYTES = 24

export type OidcHandoffs<Payload> = {
  put: (payload: Payload) => string
  take: (code: string) => Payload | null
}

export function createOidcHandoffs<Payload>(clock: () => number = Date.now): OidcHandoffs<Payload> {
  const waiting = new Map<string, { payload: Payload; expiresAt: number }>()

  function sweep(): void {
    for (const [code, entry] of waiting) {
      if (entry.expiresAt <= clock()) {
        waiting.delete(code)
      }
    }
  }

  return {
    put: (payload) => {
      sweep()
      const code = randomBytes(CODE_BYTES).toString('base64url')
      waiting.set(code, { payload, expiresAt: clock() + HANDOFF_LIFETIME_MS })
      return code
    },
    take: (code) => {
      sweep()
      const entry = waiting.get(code)
      waiting.delete(code)
      return entry?.payload ?? null
    },
  }
}
