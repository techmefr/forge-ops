export const LEASE_MINUTES = 90

export type ScopeClaim = {
  storyId: number
  pathPrefix: string
  symbols: readonly string[]
}

export type ScopeCollision = {
  storyIds: readonly number[]
  reason: string
}

export function normalisePath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  const kept: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue
    }
    if (part === '..') {
      kept.pop()
      continue
    }
    kept.push(part)
  }
  return kept.join('/')
}

function contains(outer: string, inner: string): boolean {
  return outer === inner || inner.startsWith(`${outer}/`)
}

function sharedSymbol(left: ScopeClaim, right: ScopeClaim): string | null {
  const known = new Set(right.symbols.map((symbol) => symbol.toLowerCase()))
  return left.symbols.find((symbol) => known.has(symbol.toLowerCase())) ?? null
}

function reasonFor(left: ScopeClaim, right: ScopeClaim): string | null {
  if (left.storyId === right.storyId) {
    return null
  }
  const here = normalisePath(left.pathPrefix)
  const there = normalisePath(right.pathPrefix)
  if (contains(here, there)) {
    return `${here} contient ${there}`
  }
  if (contains(there, here)) {
    return `${there} contient ${here}`
  }
  const symbol = sharedSymbol(left, right)
  return symbol === null ? null : `les deux touchent ${symbol}`
}

export function sharesScope(left: ScopeClaim, right: ScopeClaim): boolean {
  return reasonFor(left, right) !== null
}

export function collisionsBetween(claims: readonly ScopeClaim[]): readonly ScopeCollision[] {
  const found: ScopeCollision[] = []
  for (let index = 0; index < claims.length; index += 1) {
    for (let other = index + 1; other < claims.length; other += 1) {
      const left = claims[index]
      const right = claims[other]
      if (left === undefined || right === undefined) {
        continue
      }
      const reason = reasonFor(left, right)
      if (reason !== null) {
        found.push({ storyIds: [left.storyId, right.storyId].sort((a, b) => a - b), reason })
      }
    }
  }
  return found
}
