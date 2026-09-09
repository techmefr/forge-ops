export type DispatchRate = {
  burst: number
  windowMs: number
}

export type Clock = () => number

export const DEFAULT_DISPATCH_RATE: DispatchRate = {
  burst: 6,
  windowMs: 60_000,
}

export type RateBucket = {
  take: (at: number) => boolean
  countInWindow: (at: number) => number
}

export function createRateBucket({ burst, windowMs }: DispatchRate): RateBucket {
  let stamps: number[] = []

  function forget(at: number): void {
    stamps = stamps.filter((stamp) => at - stamp < windowMs)
  }

  return {
    take: (at) => {
      forget(at)
      if (stamps.length >= burst) {
        return false
      }
      stamps.push(at)
      return true
    },

    countInWindow: (at) => {
      forget(at)
      return stamps.length
    },
  }
}
