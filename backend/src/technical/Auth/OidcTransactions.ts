import { randomBytes } from 'node:crypto'

const TRANSACTION_LIFETIME_MS = 10 * 60 * 1000
const STATE_BYTES = 24
export const OIDC_STORE_CAP = 10_000

export type OidcTransaction = {
  provider: string
  nonce: string
  verifier: string
  isDesktop: boolean
  challenge: string | null
}

export type OidcTransactions = {
  open: (transaction: OidcTransaction) => string
  take: (state: string) => OidcTransaction | null
}

export function createOidcTransactions(
  clock: () => number = Date.now,
  cap: number = OIDC_STORE_CAP,
): OidcTransactions {
  const pending = new Map<string, OidcTransaction & { expiresAt: number }>()

  function makeRoom(): void {
    if (pending.size < cap) {
      return
    }
    for (const [state, entry] of pending) {
      if (entry.expiresAt <= clock()) {
        pending.delete(state)
      }
    }
    while (pending.size >= cap) {
      const oldest = pending.keys().next()
      if (oldest.done === true) {
        return
      }
      pending.delete(oldest.value)
    }
  }

  return {
    open: (transaction) => {
      makeRoom()
      const state = randomBytes(STATE_BYTES).toString('base64url')
      pending.set(state, { ...transaction, expiresAt: clock() + TRANSACTION_LIFETIME_MS })
      return state
    },
    take: (state) => {
      const entry = pending.get(state)
      pending.delete(state)
      return entry === undefined || entry.expiresAt <= clock() ? null : entry
    },
  }
}
