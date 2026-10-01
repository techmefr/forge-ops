import { describe, expect, it } from 'vitest'
import {
  phaseOfStep,
  statusOf,
  stateOfStep,
  type LatestSession,
} from '../../../src/domain/ForgeCard/ForgeCardStatus.js'

const KEYS = ['architecture', 'plan_review', 'building', 'security', 'shipping']

function session(lifecycle: string, outcome: string | null = null): LatestSession {
  return { phase: 'code', lifecycle, outcome }
}

describe('phaseOfStep', () => {
  it('maps the historical step keys to their phase', () => {
    expect(phaseOfStep('building', KEYS)).toBe('code')
    expect(phaseOfStep('shipping', KEYS)).toBe('ship')
  })

  it('lets a custom step inherit the phase of the nearest known step before it', () => {
    expect(phaseOfStep('security', KEYS)).toBe('code')
  })

  it('falls back to the spec phase when nothing known precedes a custom step', () => {
    expect(phaseOfStep('triage', ['triage', 'building'])).toBe('spec')
  })
})

describe('stateOfStep', () => {
  it('keeps the historical state of a historical step', () => {
    expect(stateOfStep('gating')).toBe('gating')
  })

  it('files a custom step under an in-progress state', () => {
    expect(stateOfStep('security')).toBe('building')
  })
})

describe('statusOf', () => {
  const base = { stepKey: 'building', stepIsHuman: false, currentPhase: 'code' as const }

  it('is done in the done column and idle in the backlog', () => {
    expect(statusOf({ ...base, stepKey: 'done', latest: null })).toBe('done')
    expect(statusOf({ ...base, stepKey: 'backlog', latest: session('working') })).toBe('idle')
  })

  it('is a human review in a human step, whatever a finished or failed session says', () => {
    expect(statusOf({ ...base, stepIsHuman: true, latest: session('failed') })).toBe('human_review')
  })

  it('keeps showing a running session when its step is switched to a human one', () => {
    expect(statusOf({ ...base, stepIsHuman: true, latest: session('working') })).toBe('running')
    expect(statusOf({ ...base, stepIsHuman: true, latest: session('starting') })).toBe('running')
  })

  it('is running while the agent starts or works', () => {
    expect(statusOf({ ...base, latest: session('starting') })).toBe('running')
    expect(statusOf({ ...base, latest: session('working') })).toBe('running')
  })

  it('waits for validation when the agent finished well or asks for a human', () => {
    expect(statusOf({ ...base, latest: session('finished', 'succeeded') })).toBe('to_validate')
    expect(statusOf({ ...base, latest: session('awaiting_human') })).toBe('to_validate')
  })

  it('is failed when the session failed, was interrupted or ended badly', () => {
    expect(statusOf({ ...base, latest: session('failed') })).toBe('failed')
    expect(statusOf({ ...base, latest: session('interrupted') })).toBe('failed')
    expect(statusOf({ ...base, latest: session('finished', 'timed_out') })).toBe('failed')
  })

  it('ignores a session that belongs to another step', () => {
    expect(statusOf({ ...base, currentPhase: 'gate', latest: session('failed') })).toBe('idle')
  })

  it('is idle in a step nobody launched yet', () => {
    expect(statusOf({ ...base, latest: null })).toBe('idle')
  })
})
