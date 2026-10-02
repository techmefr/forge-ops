import { describe, expect, it } from 'vitest'
import { stepBriefOf } from '../../../src/domain/Autopilot/StepBrief.js'

function briefOf(overrides: Partial<Parameters<typeof stepBriefOf>[0]>): string {
  return stepBriefOf({ storyReference: 'FORGE-7', stepKey: 'build', proves: null, ...overrides }).join('\n')
}

describe('the pipeline brief', () => {
  it('asks the agent for the proof of a spec or a plan only', () => {
    expect(briefOf({ stepKey: 'spec', proves: 'spec_done', phase: 'spec' })).toContain('proof of spec_done')
    expect(briefOf({ stepKey: 'plan', proves: 'arch_done', phase: 'architecture' })).toContain('proof of arch_done')
  })

  it('never asks the agent for a proof the orchestrator writes itself', () => {
    const brief = briefOf({ proves: 'build_done', phase: 'code' })

    expect(brief).not.toContain('proof of build_done')
    expect(brief).toContain('FORGE-7/build.verdict.json')
  })

  it('tells a building agent that its commits are read and its tests are rerun without its code', () => {
    const brief = briefOf({ proves: 'build_done', phase: 'code' })

    expect(brief).toContain('Commit your work on the story branch')
    expect(brief).toContain('production code of the story is reverted')
  })

  it('does not ask a spec agent to commit', () => {
    expect(briefOf({ stepKey: 'spec', proves: 'spec_done', phase: 'spec' })).not.toContain('Commit your work')
  })

  it('asks a reviewer for one result per lens and one answer per declared criterion', () => {
    const brief = briefOf({ stepKey: 'review', proves: 'reviewed', phase: 'review', criteriaReferences: ['AC-1', 'AC-2'] })

    expect(brief).toContain('"quality"')
    expect(brief).toContain('"security"')
    expect(brief).toContain('"accessibility"')
    expect(brief).toContain('"reference":"AC-1"')
    expect(brief).toContain('"reference":"AC-2"')
  })

  it('carries the feedback of a rejected attempt', () => {
    expect(briefOf({ feedback: 'the tests also pass without the code' })).toContain('the tests also pass without the code')
  })
})
