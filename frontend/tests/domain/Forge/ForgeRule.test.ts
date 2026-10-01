import { describe, expect, it } from 'vitest'
import type { ForgeCardStatus, ForgeCardView } from '@contract/ForgeCardContract'
import type { WorkflowColumn } from '@contract/WorkflowColumnContract'
import type { EpicOverview } from '@contract/StoryContract'
import {
  activeProjectOf,
  adjacentStep,
  boardSteps,
  canDropInto,
  cardsOfStep,
  dotsOf,
  filterBySubject,
  holdableSubjects,
  firstStepKey,
  referenceLabel,
  pipelineOrder,
  primaryActionOf,
  secondaryActionOf,
  gapCodesOf,
  isLastStep,
} from '@/domain/Forge/ForgeRule'

function column(id: number, key: string, overrides: Partial<WorkflowColumn> = {}): WorkflowColumn {
  return {
    id,
    projectId: 1,
    key,
    label: key.toUpperCase(),
    colour: 'acc',
    position: id,
    provider: 'claude',
    model: 'claude-sonnet-5',
    effort: 'high',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: false,
    behaviouralKind: 'ordinary',
    ...overrides,
  }
}

function card(id: number, stepKey: string, status: ForgeCardStatus, overrides: Partial<ForgeCardView> = {}): ForgeCardView {
  return {
    id,
    reference: `FORGE-${id}`,
    storyId: id,
    storyReference: `S-${id}`,
    title: `Story ${id}`,
    projectId: 1,
    subjectId: 10,
    subjectTitle: 'Subject',
    stepKey,
    provider: 'claude',
    status,
    claudeSessionId: null,
    durationSeconds: 0,
    costUsd: 0,
    ...overrides,
  }
}

const LABELS = { backlog: 'Backlog', done: 'Done' }

const STEPS = boardSteps(
  [
    column(1, 'spec', { autoStart: true }),
    column(2, 'review', { provider: 'human', model: '', effort: '' }),
    column(3, 'build'),
  ],
  LABELS,
)

describe('boardSteps', () => {
  it('puts the backlog first and done last around the steps of the project', () => {
    expect(STEPS.map((step) => step.key)).toEqual(['backlog', 'spec', 'review', 'build', 'done'])
    expect(STEPS.map((step) => step.kind)).toEqual(['backlog', 'step', 'step', 'step', 'done'])
  })

  it('flags the auto steps and the human steps', () => {
    expect(STEPS.find((step) => step.key === 'spec')).toMatchObject({ auto: true, human: false })
    expect(STEPS.find((step) => step.key === 'review')).toMatchObject({ auto: false, human: true })
  })

  it('keeps just the backlog and done when the project has no step', () => {
    expect(boardSteps([], LABELS).map((step) => step.key)).toEqual(['backlog', 'done'])
  })
})

describe('filtering', () => {
  const cards = [card(1, 'spec', 'idle'), card(2, 'spec', 'idle', { subjectId: 11 })]

  it('keeps the cards of a step', () => {
    expect(cardsOfStep(cards, 'spec')).toHaveLength(2)
    expect(cardsOfStep(cards, 'build')).toHaveLength(0)
  })

  it('keeps the cards of a subject, or all of them', () => {
    expect(filterBySubject(cards, 11).map((entry) => entry.id)).toEqual([2])
    expect(filterBySubject(cards, null)).toHaveLength(2)
  })
})

describe('moving with the arrows', () => {
  it('goes to the neighbour step on either side', () => {
    const middle = card(1, 'review', 'human_review')
    expect(adjacentStep(STEPS, middle, -1)?.key).toBe('spec')
    expect(adjacentStep(STEPS, middle, 1)?.key).toBe('build')
  })

  it('stops at the backlog on the left and before done on the right', () => {
    expect(adjacentStep(STEPS, card(1, 'backlog', 'idle'), -1)).toBeNull()
    expect(adjacentStep(STEPS, card(1, 'build', 'idle'), 1)).toBeNull()
  })

  it('does not move a running card nor a done one', () => {
    expect(adjacentStep(STEPS, card(1, 'spec', 'running'), 1)).toBeNull()
    expect(adjacentStep(STEPS, card(1, 'done', 'done'), -1)).toBeNull()
  })
})

describe('dropping', () => {
  const done = STEPS.find((step) => step.key === 'done')!
  const build = STEPS.find((step) => step.key === 'build')!

  it('accepts a card in any step but its own, done and running excepted', () => {
    expect(canDropInto(card(1, 'spec', 'idle'), build)).toBe(true)
    expect(canDropInto(card(1, 'build', 'idle'), build)).toBe(false)
    expect(canDropInto(card(1, 'spec', 'idle'), done)).toBe(false)
    expect(canDropInto(card(1, 'spec', 'running'), build)).toBe(false)
  })
})

describe('dotsOf', () => {
  it('shows passed, current and to come steps of a card in the middle', () => {
    const dots = dotsOf(card(1, 'review', 'human_review'), STEPS)
    expect(dots.map((dot) => dot.state)).toEqual(['passed', 'human_review', 'to_come'])
  })

  it('shows the state of the session on the current step', () => {
    expect(dotsOf(card(1, 'spec', 'running'), STEPS)[0]?.state).toBe('running')
    expect(dotsOf(card(1, 'spec', 'failed'), STEPS)[0]?.state).toBe('failed')
    expect(dotsOf(card(1, 'spec', 'to_validate'), STEPS)[0]?.state).toBe('to_validate')
    expect(dotsOf(card(1, 'spec', 'idle'), STEPS)[0]?.state).toBe('waiting')
  })

  it('has every step to come in the backlog and every step passed when done', () => {
    expect(dotsOf(card(1, 'backlog', 'idle'), STEPS).map((dot) => dot.state)).toEqual(['to_come', 'to_come', 'to_come'])
    expect(dotsOf(card(1, 'done', 'done'), STEPS).map((dot) => dot.state)).toEqual(['passed', 'passed', 'passed'])
  })
})

describe('pipelineOrder', () => {
  it('floats the running cards, then the failed ones, to the top', () => {
    const ordered = pipelineOrder([
      card(1, 'done', 'done'),
      card(2, 'backlog', 'idle'),
      card(3, 'spec', 'to_validate'),
      card(4, 'build', 'failed'),
      card(5, 'spec', 'running'),
      card(6, 'review', 'human_review'),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual([5, 4, 3, 6, 2, 1])
  })

  it('keeps the order of the board between equals', () => {
    expect(pipelineOrder([card(7, 'spec', 'running'), card(2, 'spec', 'running')]).map((entry) => entry.id)).toEqual([2, 7])
  })
})

describe('primaryActionOf', () => {
  it('launches from the backlog when the project has steps, nothing without', () => {
    expect(primaryActionOf(card(1, 'backlog', 'idle'), STEPS)).toBe('launch')
    expect(primaryActionOf(card(1, 'backlog', 'idle'), boardSteps([], LABELS))).toBeNull()
  })

  it('stops a running card and retries a failed one', () => {
    expect(primaryActionOf(card(1, 'spec', 'running'), STEPS)).toBe('stop')
    expect(primaryActionOf(card(1, 'spec', 'failed'), STEPS)).toBe('retry')
  })

  it('validates a card that waits, and closes it from the last step', () => {
    expect(primaryActionOf(card(1, 'spec', 'to_validate'), STEPS)).toBe('validate')
    expect(primaryActionOf(card(1, 'review', 'human_review'), STEPS)).toBe('validate')
    expect(primaryActionOf(card(1, 'build', 'to_validate'), STEPS)).toBe('validate')
  })

  it('offers no launch in a human step and nothing when done', () => {
    expect(primaryActionOf(card(1, 'done', 'done'), STEPS)).toBeNull()
    expect(primaryActionOf(card(1, 'spec', 'idle'), STEPS)).toBe('launch')
  })
})

describe('secondaryActionOf', () => {
  it('offers Stop on a card that only waits to be validated', () => {
    expect(secondaryActionOf(card(1, 'spec', 'to_validate'))).toBe('stop')
  })

  it('offers nothing on the other states', () => {
    expect(secondaryActionOf(card(1, 'spec', 'running'))).toBeNull()
    expect(secondaryActionOf(card(1, 'spec', 'failed'))).toBeNull()
    expect(secondaryActionOf(card(1, 'spec', 'idle'))).toBeNull()
    expect(secondaryActionOf(card(1, 'done', 'done'))).toBeNull()
  })
})

describe('project choice', () => {
  const projects = [{ id: 4 }, { id: 9 }]

  it('restores the project remembered, else takes the first', () => {
    expect(activeProjectOf(projects, '9')).toBe(9)
    expect(activeProjectOf(projects, '77')).toBe(4)
    expect(activeProjectOf([], '9')).toBeNull()
  })

  it('names the first step a card of the backlog enters', () => {
    expect(firstStepKey(STEPS)).toBe('spec')
    expect(firstStepKey(boardSteps([], LABELS))).toBeNull()
  })

  it('shows a single reference when the card and its story share it', () => {
    expect(referenceLabel({ storyReference: 'FORGE-8', reference: 'FORGE-8' })).toBe('FORGE-8')
    expect(referenceLabel({ storyReference: 'FORGE-8', reference: 'FORGE-8-2' })).toBe('FORGE-8 · FORGE-8-2')
  })
})

describe('thin story reasons', () => {
  it('keeps only the gap codes the interface can say', () => {
    expect(gapCodesOf({ gapCodes: ['CriteriaMissing', 'Nope', 3] })).toEqual(['CriteriaMissing'])
    expect(gapCodesOf({})).toEqual([])
  })

  it('knows the last step of a workflow', () => {
    expect(isLastStep(STEPS, card(1, 'build', 'to_validate'))).toBe(true)
    expect(isLastStep(STEPS, card(1, 'spec', 'to_validate'))).toBe(false)
  })
})

describe('holdableSubjects', () => {
  const subjects = [
    { id: 1, assignee: null },
    { id: 2, assignee: 'anna' },
    { id: 3, assignee: 'bob' },
  ] as unknown as readonly EpicOverview[]

  it('keeps the free subjects and the ones the person holds', () => {
    expect(holdableSubjects(subjects, 'anna').map((subject) => subject.id)).toEqual([1, 2])
  })

  it('keeps everything while nobody is known, the server decides', () => {
    expect(holdableSubjects(subjects, null)).toHaveLength(3)
  })
})
