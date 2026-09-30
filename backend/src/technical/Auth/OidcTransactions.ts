import { randomBytes } from 'node:crypto'

const TRANSACTION_LIFETIME_MS = 10 * 60 * 1000
const STATE_BYTES = 24

export type OidcTransaction = {
  provider: string
  nonce: string
  verifier: string
}

export type OidcTransactions = {
  open: (transaction: OidcTransaction) => string
  take: (state: string) => OidcTransaction | null
}

export function createOidcTransactions(clock: () => number = Date.now): OidcTransactions {
  const pending = new Map<string, OidcTransaction & { expiresAt: number }>()

  function sweep(): void {
    for (const [state, entry] of pending) {
      if (entry.expiresAt <= clock()) {
        pending.delete(state)
      }
    }
  }

  return {
    open: (transaction) => {
      sweep()
      const state = randomBytes(STATE_BYTES).toString('base64url')
      pending.set(state, { ...transaction, expiresAt: clock() + TRANSACTION_LIFETIME_MS })
      return state
    },
    take: (state) => {
      sweep()
      const entry = pending.get(state)
      pending.delete(state)
      return entry ?? null
    },
  }
}
