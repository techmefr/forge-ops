import { describe, expect, it } from 'vitest'
import {
  assertHumanHand,
  assertStepBack,
  assertStepBackReason,
  checkpointsAheadOf,
} from '../../../src/domain/Story/StepBack.js'
import {
  AgentStepBackRefusedError,
  StepBackFromDoneError,
  StepBackNotBackwardError,
  StepBackOffPipelineError,
  StepBackReasonRequiredError,
} from '../../../src/domain/Story/StoryViolation.js'

describe('assertStepBack', () => {
  it('accepts a walk back to an earlier phase of the pipeline', () => {
    expect(() => assertStepBack('FORGE-1', 'reviewing', 'building')).not.toThrow()
  })

  it('refuses a story already merged', () => {
    expect(() => assertStepBack('FORGE-1', 'done', 'building')).toThrow(StepBackFromDoneError)
  })

  it('refuses a state that is not behind the current one', () => {
    expect(() => assertStepBack('FORGE-1', 'building', 'building')).toThrow(StepBackNotBackwardError)
    expect(() => assertStepBack('FORGE-1', 'building', 'gating')).toThrow(StepBackNotBackwardError)
  })

  it('refuses a story sitting outside the pipeline', () => {
    expect(() => assertStepBack('FORGE-1', 'escalated', 'building')).toThrow(StepBackOffPipelineError)
    expect(() => assertStepBack('FORGE-1', 'flagged', 'building')).toThrow(StepBackOffPipelineError)
  })
})

describe('assertStepBackReason', () => {
  it('returns the trimmed reason', () => {
    expect(assertStepBackReason('FORGE-1', '  plan wrong  ')).toBe('plan wrong')
  })

  it('refuses a blank reason', () => {
    expect(() => assertStepBackReason('FORGE-1', '   ')).toThrow(StepBackReasonRequiredError)
  })
})

describe('assertHumanHand', () => {
  it('lets a bare human request through', () => {
    expect(() => assertHumanHand({}, 'Reculer une story')).not.toThrow()
  })

  it('refuses a request carrying an agent session', () => {
    expect(() => assertHumanHand({ claudeSessionId: 'sess-1' }, 'Reculer une story')).toThrow(AgentStepBackRefusedError)
  })

  it('refuses a request carrying an agent name', () => {
    expect(() => assertHumanHand({ agentName: 'trinity' }, 'Reculer une story')).toThrow(AgentStepBackRefusedError)
  })
})

describe('checkpointsAheadOf', () => {
  it('drops everything the new phase has not reached yet', () => {
    expect(checkpointsAheadOf('building')).toEqual(['build_done', 'verified', 'reviewed'])
  })

  it('keeps the checkpoint that opened the new phase', () => {
    expect(checkpointsAheadOf('gating')).toEqual(['verified', 'reviewed'])
  })

  it('drops the whole sequence for a walk back to the backlog', () => {
    expect(checkpointsAheadOf('backlog')).toEqual([
      'spec_done',
      'arch_done',
      'tests_written',
      'build_done',
      'verified',
      'reviewed',
    ])
  })
})
