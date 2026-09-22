import { describe, expect, it } from 'vitest'
import { createHighlightCache } from '../../../src/technical/File/HighlightCache.js'

describe('createHighlightCache', () => {
  it('returns what was set for the same path and mtime', () => {
    const cache = createHighlightCache<string>()
    cache.set({ path: 'a.ts', mtimeMs: 1 }, 'rendered-a')
    expect(cache.get({ path: 'a.ts', mtimeMs: 1 })).toBe('rendered-a')
  })

  it('treats a changed mtime as a different entry, not an overwrite', () => {
    const cache = createHighlightCache<string>()
    cache.set({ path: 'a.ts', mtimeMs: 1 }, 'old')
    cache.set({ path: 'a.ts', mtimeMs: 2 }, 'new')
    expect(cache.get({ path: 'a.ts', mtimeMs: 1 })).toBe('old')
    expect(cache.get({ path: 'a.ts', mtimeMs: 2 })).toBe('new')
  })

  it('evicts the least recently used entry once the bound is reached', () => {
    const cache = createHighlightCache<string>({ maxEntries: 2 })
    cache.set({ path: 'a.ts', mtimeMs: 1 }, 'a')
    cache.set({ path: 'b.ts', mtimeMs: 1 }, 'b')
    cache.set({ path: 'c.ts', mtimeMs: 1 }, 'c')
    expect(cache.size()).toBe(2)
    expect(cache.get({ path: 'a.ts', mtimeMs: 1 })).toBeNull()
    expect(cache.get({ path: 'b.ts', mtimeMs: 1 })).toBe('b')
    expect(cache.get({ path: 'c.ts', mtimeMs: 1 })).toBe('c')
  })

  it('reading an entry counts as using it, so it survives eviction over an untouched one', () => {
    const cache = createHighlightCache<string>({ maxEntries: 2 })
    cache.set({ path: 'a.ts', mtimeMs: 1 }, 'a')
    cache.set({ path: 'b.ts', mtimeMs: 1 }, 'b')
    cache.get({ path: 'a.ts', mtimeMs: 1 })
    cache.set({ path: 'c.ts', mtimeMs: 1 }, 'c')
    expect(cache.get({ path: 'b.ts', mtimeMs: 1 })).toBeNull()
    expect(cache.get({ path: 'a.ts', mtimeMs: 1 })).toBe('a')
    expect(cache.get({ path: 'c.ts', mtimeMs: 1 })).toBe('c')
  })

  it('never grows past the stated bound', () => {
    const cache = createHighlightCache<string>({ maxEntries: 3 })
    for (let index = 0; index < 50; index += 1) {
      cache.set({ path: `file-${index}.ts`, mtimeMs: 1 }, `render-${index}`)
    }
    expect(cache.size()).toBe(3)
  })
})
