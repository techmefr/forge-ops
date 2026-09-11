export const LOGIN_WINDOW_MS = 60_000

export const LOGIN_ATTEMPT_CAP = 10

const DEFAULT_TRACKED_CAP = 512

type Attempts = {
  failures: number
  startedAt: number
}

export type LoginRateLimit = {
  refuses: (key: string) => boolean
  recordFailure: (key: string) => void
  forget: (key: string) => void
  retryAfterMs: (key: string) => number
  count: () => number
}

export type LoginRateLimitInput = {
  windowMs?: number
  attemptCap?: number
  cap?: number
  clock?: () => number
}

export function createLoginRateLimit({
  windowMs = LOGIN_WINDOW_MS,
  attemptCap = LOGIN_ATTEMPT_CAP,
  cap = DEFAULT_TRACKED_CAP,
  clock = Date.now,
}: LoginRateLimitInput = {}): LoginRateLimit {
  const attempts = new Map<string, Attempts>()

  function discardStale(): void {
    const now = clock()
    for (const [key, entry] of attempts) {
      if (now - entry.startedAt >= windowMs) {
        attempts.delete(key)
      }
    }
  }

  function current(key: string): Attempts | null {
    const entry = attempts.get(key)
    if (entry === undefined) {
      return null
    }
    if (clock() - entry.startedAt >= windowMs) {
      attempts.delete(key)
      return null
    }
    return entry
  }

  function makeRoom(): void {
    discardStale()
    while (attempts.size >= cap) {
      const oldest = attempts.keys().next()
      if (oldest.done === true) {
        return
      }
      attempts.delete(oldest.value)
    }
  }

  return {
    refuses: (key) => (current(key)?.failures ?? 0) >= attemptCap,

    recordFailure: (key) => {
      const entry = current(key)
      if (entry === null) {
        makeRoom()
        attempts.set(key, { failures: 1, startedAt: clock() })
        return
      }
      entry.failures += 1
    },

    forget: (key) => {
      attempts.delete(key)
    },

    retryAfterMs: (key) => {
      const entry = current(key)
      if (entry === null || entry.failures < attemptCap) {
        return 0
      }
      return windowMs - (clock() - entry.startedAt)
    },

    count: () => {
      discardStale()
      return attempts.size
    },
  }
}
