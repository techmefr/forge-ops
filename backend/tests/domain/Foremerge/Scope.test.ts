import { describe, expect, it } from 'vitest'
import { collisionsBetween, normalisePath, sharesScope } from '../../../src/domain/Foremerge/Scope.js'

const DOMAINE = { storyId: 1, pathPrefix: 'backend/src/domain/Story', symbols: ['writeStory'] }

describe('normalisePath', () => {
  it('drops a leading slash, so the same folder is not claimed twice', () => {
    expect(normalisePath('/backend/src')).toBe('backend/src')
  })

  it('drops a trailing slash', () => {
    expect(normalisePath('backend/src/')).toBe('backend/src')
  })

  it('collapses a doubled separator', () => {
    expect(normalisePath('backend//src')).toBe('backend/src')
  })

  it('rewrites a windows separator, the repository only knows one form', () => {
    expect(normalisePath('backend\\src')).toBe('backend/src')
  })

  it('resolves a step back up the tree', () => {
    expect(normalisePath('backend/src/domain/../technical')).toBe('backend/src/technical')
  })
})

describe('sharesScope', () => {
  it('sees no overlap between two unrelated folders', () => {
    expect(
      sharesScope(DOMAINE, { storyId: 2, pathPrefix: 'frontend/src/domain/Kanban', symbols: [] }),
    ).toBe(false)
  })

  it('sees an overlap on the very same folder', () => {
    expect(sharesScope(DOMAINE, { storyId: 2, pathPrefix: 'backend/src/domain/Story', symbols: [] })).toBe(
      true,
    )
  })

  it('sees an overlap when one claim sits inside the other', () => {
    expect(sharesScope(DOMAINE, { storyId: 2, pathPrefix: 'backend/src', symbols: [] })).toBe(true)
  })

  it('does not confuse two folders that merely share a name prefix', () => {
    expect(
      sharesScope(DOMAINE, { storyId: 2, pathPrefix: 'backend/src/domain/StoryReport', symbols: [] }),
    ).toBe(false)
  })

  it('sees an overlap on a shared symbol even in different folders', () => {
    expect(
      sharesScope(DOMAINE, {
        storyId: 2,
        pathPrefix: 'frontend/src/domain/Story',
        symbols: ['writeStory'],
      }),
    ).toBe(true)
  })

  it('ignores the case of a symbol, a rename is a rename', () => {
    expect(
      sharesScope(DOMAINE, { storyId: 2, pathPrefix: 'frontend/src', symbols: ['WRITESTORY'] }),
    ).toBe(true)
  })

  it('never reports a story colliding with itself', () => {
    expect(sharesScope(DOMAINE, { ...DOMAINE, storyId: 1 })).toBe(false)
  })
})

describe('collisionsBetween', () => {
  it('finds nothing among claims that do not meet', () => {
    expect(
      collisionsBetween([
        DOMAINE,
        { storyId: 2, pathPrefix: 'frontend/src/domain/Kanban', symbols: [] },
      ]),
    ).toEqual([])
  })

  it('reports the pair that collides, and what they share', () => {
    expect(
      collisionsBetween([DOMAINE, { storyId: 2, pathPrefix: 'backend/src', symbols: [] }]),
    ).toEqual([{ storyIds: [1, 2], reason: 'backend/src contient backend/src/domain/Story' }])
  })

  it('names the shared symbol when the folders do not meet', () => {
    expect(
      collisionsBetween([
        DOMAINE,
        { storyId: 2, pathPrefix: 'frontend/src', symbols: ['writeStory'] },
      ])[0]?.reason,
    ).toBe('les deux touchent writeStory')
  })

  it('reports a pair once, not twice', () => {
    expect(
      collisionsBetween([DOMAINE, { storyId: 2, pathPrefix: 'backend/src', symbols: [] }]),
    ).toHaveLength(1)
  })
})
