import { describe, expect, it } from 'vitest'
import {
  AGENT_PHASE_SEQUENCE,
  CHECKPOINT_SEQUENCE,
  COMPLETENESS_FLOOR,
  REVIEW_LENS_SEQUENCE,
  STORY_STATE_SEQUENCE,
} from '@/domain/Board/BoardModel'
import { CHECKPOINT_LABELS, LENS_LABELS, STATE_LABELS } from '@/domain/Story/Checkpoint'
import { AGENT_PHASE_SEQUENCE as PHASES_BACK } from '../../../../backend/src/domain/Agent/AgentSession.js'
import {
  CHECKPOINT_SEQUENCE as CHECKPOINTS_BACK,
  REVIEW_LENS_SEQUENCE as LENSES_BACK,
} from '../../../../backend/src/domain/Checkpoint/Checkpoint.js'
import { STORY_STATE_SEQUENCE as STATES_BACK } from '../../../../backend/src/domain/Story/Story.js'
import { COMPLETENESS_FLOOR as FLOOR_BACK } from '../../../../backend/src/domain/Story/Completeness.js'

describe('le front et le back lisent le meme contrat', () => {
  it('tient les etats de story depuis le module partage', () => {
    expect(STORY_STATE_SEQUENCE).toBe(STATES_BACK)
  })

  it('tient les jalons depuis le module partage', () => {
    expect(CHECKPOINT_SEQUENCE).toBe(CHECKPOINTS_BACK)
  })

  it('tient les phases d agent depuis le module partage', () => {
    expect(AGENT_PHASE_SEQUENCE).toBe(PHASES_BACK)
  })

  it('tient les angles de review depuis le module partage', () => {
    expect(REVIEW_LENS_SEQUENCE).toBe(LENSES_BACK)
  })

  it('tient le plancher de completude depuis le module partage', () => {
    expect(COMPLETENESS_FLOOR).toBe(FLOOR_BACK)
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
