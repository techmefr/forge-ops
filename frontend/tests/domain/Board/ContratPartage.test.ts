import { describe, expect, it } from 'vitest'
import {
  AGENT_PHASE_SEQUENCE,
  CHECKPOINT_SEQUENCE,
  REVIEW_LENS_SEQUENCE,
  STORY_STATE_SEQUENCE,
} from '@/domain/Board/BoardModel'
import { CHECKPOINT_LABELS, LENS_LABELS, STATE_LABELS } from '@/domain/Story/Checkpoint'
import {
  AGENT_PHASE_SEQUENCE as PHASES_BACK,
} from '../../../../backend/src/domain/Agent/AgentSession.js'
import {
  CHECKPOINT_SEQUENCE as CHECKPOINTS_BACK,
  REVIEW_LENS_SEQUENCE as LENSES_BACK,
} from '../../../../backend/src/domain/Checkpoint/Checkpoint.js'
import { STORY_STATE_SEQUENCE as STATES_BACK } from '../../../../backend/src/domain/Story/Story.js'

describe('le contrat du front suit celui du back', () => {
  it('reprend les etats de story a l identique', () => {
    expect([...STORY_STATE_SEQUENCE]).toEqual([...STATES_BACK])
  })

  it('reprend les jalons a l identique', () => {
    expect([...CHECKPOINT_SEQUENCE]).toEqual([...CHECKPOINTS_BACK])
  })

  it('reprend les phases d agent a l identique', () => {
    expect([...AGENT_PHASE_SEQUENCE]).toEqual([...PHASES_BACK])
  })

  it('reprend les angles de review a l identique', () => {
    expect([...REVIEW_LENS_SEQUENCE]).toEqual([...LENSES_BACK])
  })
})

describe('chaque valeur du contrat porte un libelle', () => {
  it('nomme chaque etat de story', () => {
    expect(Object.keys(STATE_LABELS)).toEqual([...STORY_STATE_SEQUENCE])
  })

  it('nomme chaque jalon', () => {
    expect(Object.keys(CHECKPOINT_LABELS)).toEqual([...CHECKPOINT_SEQUENCE])
  })

  it('nomme chaque angle de review', () => {
    expect(Object.keys(LENS_LABELS)).toEqual([...REVIEW_LENS_SEQUENCE])
  })
})
