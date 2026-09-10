import { describe, expect, it } from 'vitest'
import {
  advanceCascade,
  LENS_AGENTS,
  nextLensOf,
  runningLensOf,
} from '../../../src/domain/Checkpoint/ReviewCascade.js'
import { REVIEW_LENS_SEQUENCE, type ReviewLens, type ReviewPass } from '../../../src/domain/Checkpoint/Checkpoint.js'

function cascade(states: readonly ReviewPass['state'][]): readonly ReviewPass[] {
  return REVIEW_LENS_SEQUENCE.map((lens, index) => ({
    lens,
    state: states[index] ?? 'pending',
    agentName: null,
  }))
}

describe('LENS_AGENTS', () => {
  it('gives every lens its own reader', () => {
    expect(Object.keys(LENS_AGENTS)).toEqual([...REVIEW_LENS_SEQUENCE])
  })

  it('never sends the same agent twice, a reader does not review itself', () => {
    expect(new Set(Object.values(LENS_AGENTS)).size).toBe(REVIEW_LENS_SEQUENCE.length)
  })
})

describe('nextLensOf', () => {
  it('starts with the first lens of the sequence', () => {
    expect(nextLensOf(cascade([]))).toBe('quality')
  })

  it('moves on once the first one passed', () => {
    expect(nextLensOf(cascade(['passed']))).toBe('security')
  })

  it('rends nothing once every lens passed', () => {
    expect(nextLensOf(cascade(['passed', 'passed', 'passed']))).toBeNull()
  })

  it('does not skip a lens that is merely running', () => {
    expect(nextLensOf(cascade(['running']))).toBe('quality')
  })
})

describe('runningLensOf', () => {
  it('rends nothing on an untouched cascade', () => {
    expect(runningLensOf(cascade([]))).toBeNull()
  })

  it('names the lens a reader is working on', () => {
    expect(runningLensOf(cascade(['passed', 'running']))).toBe('security')
  })
})

describe('advanceCascade', () => {
  it('dispatches the first lens of an untouched cascade', async () => {
    const asked: ReviewLens[] = []

    const step = await advanceCascade({
      cascade: cascade([]),
      dispatchLens: (lens) => {
        asked.push(lens)
        return Promise.resolve()
      },
    })

    expect(asked).toEqual(['quality'])
    expect(step.dispatched).toBe('quality')
  })

  it('dispatches the next lens once the previous one passed', async () => {
    const step = await advanceCascade({
      cascade: cascade(['passed']),
      dispatchLens: () => Promise.resolve(),
    })

    expect(step.dispatched).toBe('security')
  })

  it('waits while a reader is still working', async () => {
    const asked: ReviewLens[] = []

    const step = await advanceCascade({
      cascade: cascade(['running']),
      dispatchLens: (lens) => {
        asked.push(lens)
        return Promise.resolve()
      },
    })

    expect(asked).toEqual([])
    expect(step.dispatched).toBeNull()
  })

  it('says it is waiting, and on which lens', async () => {
    const step = await advanceCascade({
      cascade: cascade(['running']),
      dispatchLens: () => Promise.resolve(),
    })

    expect(step.reason).toContain('quality')
  })

  it('dispatches nothing once the cascade is through', async () => {
    const step = await advanceCascade({
      cascade: cascade(['passed', 'passed', 'passed']),
      dispatchLens: () => Promise.resolve(),
    })

    expect(step).toEqual({ dispatched: null, reason: 'la cascade est passee en entier' })
  })

  it('reports a refused dispatch rather than losing the checkpoint that triggered it', async () => {
    const step = await advanceCascade({
      cascade: cascade([]),
      dispatchLens: () => Promise.reject(new Error('la flotte est saturee')),
    })

    expect(step).toEqual({ dispatched: null, reason: 'la flotte est saturee' })
  })

  it('does not swallow a refusal silently, the reason names it', async () => {
    const step = await advanceCascade({
      cascade: cascade(['passed']),
      dispatchLens: () => Promise.reject(new Error('plafond de cout atteint')),
    })

    expect(step.reason).toBe('plafond de cout atteint')
  })
})
