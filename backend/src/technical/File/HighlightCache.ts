export type HighlightCacheKey = {
  path: string
  mtimeMs: number
}

export type HighlightCache<T> = {
  get: (key: HighlightCacheKey) => T | null
  set: (key: HighlightCacheKey, value: T) => void
  size: () => number
}

export type HighlightCacheInput = {
  maxEntries?: number
}

export const DEFAULT_HIGHLIGHT_CACHE_MAX_ENTRIES = 200

function keyed({ path, mtimeMs }: HighlightCacheKey): string {
  return `${path}:${mtimeMs}`
}

export function createHighlightCache<T>({
  maxEntries = DEFAULT_HIGHLIGHT_CACHE_MAX_ENTRIES,
}: HighlightCacheInput = {}): HighlightCache<T> {
  const entries = new Map<string, T>()

  return {
    get(key) {
      const id = keyed(key)
      const found = entries.get(id)
      if (found === undefined) {
        return null
      }
      entries.delete(id)
      entries.set(id, found)
      return found
    },

    set(key, value) {
      const id = keyed(key)
      entries.delete(id)
      entries.set(id, value)
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value
        if (oldest !== undefined) {
          entries.delete(oldest)
        }
      }
    },

    size: () => entries.size,
  }
}
