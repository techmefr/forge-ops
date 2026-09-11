import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STORY_STATE_SEQUENCE } from '../../../src/domain/Story/Story.js'
import { STEP_BACK_TARGETS } from '../../../src/domain/Story/StepBack.js'
import { READY_STATES, WORKING_STATES } from '../../../src/domain/File/FileMark.js'
import {
  AGENT_LIFECYCLE_SEQUENCE,
  AGENT_PHASE_SEQUENCE,
} from '../../../src/domain/Agent/AgentSession.js'
import {
  CHECKPOINT_SEQUENCE,
  REVIEW_LENS_SEQUENCE,
} from '../../../src/domain/Checkpoint/Checkpoint.js'
import { PHASE_CONTRACTS } from '../../../src/domain/Dispatch/Dispatch.js'
import { EVIDENCE_SHAPE } from '../../../src/domain/Evidence/EvidenceShape.js'
import {
  AGENT_LIFECYCLE_SEQUENCE as SHARED_LIFECYCLES,
  AGENT_PHASE_SEQUENCE as SHARED_PHASES,
} from '../../../../contract/AgentContract.js'
import {
  CHECKPOINT_SEQUENCE as SHARED_CHECKPOINTS,
  REVIEW_LENS_SEQUENCE as SHARED_LENSES,
} from '../../../../contract/CheckpointContract.js'
import {
  STEP_BACK_TARGETS as SHARED_STEP_BACKS,
  STORY_STATE_SEQUENCE as SHARED_STATES,
} from '../../../../contract/StoryContract.js'

const SCHEMA = readFileSync(fileURLToPath(new URL('../../../../db/forge.sql', import.meta.url)), 'utf8')

function checkedValuesOf(table: string, column: string): readonly string[] {
  const start = SCHEMA.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`)
  if (start < 0) {
    throw new Error(`no table ${table} in the schema`)
  }
  const block = SCHEMA.slice(start, SCHEMA.indexOf(');', start))
  const opening = block.indexOf(`${column} IN (`)
  if (opening < 0) {
    throw new Error(`no CHECK on ${table}.${column}`)
  }
  const list = block.slice(opening, block.indexOf(')', opening))
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '')
}

describe('schema agrees with the domain', () => {
  it('checks story states against the domain sequence', () => {
    expect(checkedValuesOf('story', 'state')).toEqual([...STORY_STATE_SEQUENCE])
  })

  it('checks checkpoint names against the domain sequence', () => {
    expect(checkedValuesOf('checkpoint', 'name')).toEqual([...CHECKPOINT_SEQUENCE])
  })

  it('checks agent phases against the domain sequence', () => {
    expect(checkedValuesOf('agent_session', 'phase')).toEqual([...AGENT_PHASE_SEQUENCE])
  })

  it('checks agent lifecycles against the domain sequence', () => {
    expect(checkedValuesOf('agent_session', 'lifecycle')).toEqual([...AGENT_LIFECYCLE_SEQUENCE])
  })

  it('checks review lenses against the domain sequence', () => {
    expect(checkedValuesOf('review_pass', 'lens')).toEqual([...REVIEW_LENS_SEQUENCE])
  })
})

describe('the domain reads the shared contract', () => {
  it('holds the very sequences the contract declares', () => {
    expect(STORY_STATE_SEQUENCE).toBe(SHARED_STATES)
    expect(CHECKPOINT_SEQUENCE).toBe(SHARED_CHECKPOINTS)
    expect(REVIEW_LENS_SEQUENCE).toBe(SHARED_LENSES)
    expect(AGENT_PHASE_SEQUENCE).toBe(SHARED_PHASES)
    expect(AGENT_LIFECYCLE_SEQUENCE).toBe(SHARED_LIFECYCLES)
    expect(STEP_BACK_TARGETS).toBe(SHARED_STEP_BACKS)
  })
})

describe('story state membership', () => {
  it('draws every step back target from the story states', () => {
    for (const target of STEP_BACK_TARGETS) {
      expect(STORY_STATE_SEQUENCE).toContain(target)
    }
  })

  it('sorts every story state into working, ready or shipped', () => {
    const sorted = [...WORKING_STATES, ...READY_STATES, 'done']
    expect([...sorted].sort()).toEqual([...STORY_STATE_SEQUENCE].sort())
  })
})

describe('phase and checkpoint membership', () => {
  it('contracts exactly one phase each', () => {
    expect(PHASE_CONTRACTS.map((contract) => contract.phase)).toEqual([...AGENT_PHASE_SEQUENCE])
  })

  it('requires only declared checkpoints', () => {
    for (const contract of PHASE_CONTRACTS) {
      for (const required of contract.requires) {
        expect(CHECKPOINT_SEQUENCE).toContain(required)
      }
    }
  })

  it('shapes the evidence of every checkpoint', () => {
    expect(Object.keys(EVIDENCE_SHAPE)).toEqual([...CHECKPOINT_SEQUENCE])
  })
})
