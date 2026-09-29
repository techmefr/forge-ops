import { describe, expect, it } from 'vitest'
import {
  CLAUDE_MODELS,
  PROMPT_TEMPLATES,
  WORKFLOW_EFFORTS,
  workflowColumnDraftSchema,
  type WorkflowColumn,
} from '@contract/WorkflowColumnContract'
import {
  colourInputValue,
  draftOf,
  failureOf,
  isDirty,
  keysAfterMove,
  newStep,
  starterSteps,
  summaryOf,
  templateOfPrompt,
  withProvider,
} from '@/domain/Workflow/WorkflowRule'
import { BoardRequestError } from '@/technical/Api/BoardClient'

const COLUMN: WorkflowColumn = {
  id: 4,
  projectId: 1,
  key: 'build',
  position: 2,
  behaviouralKind: 'ordinary',
  label: 'Build',
  colour: 'info',
  provider: 'claude',
  model: 'claude-fable-5-1',
  effort: 'xhigh',
  agentName: 'laravel:laravel-architect',
  command: '/speckit.plan',
  preprompt: 'Go.',
  autoStart: true,
}

describe('the values offered', () => {
  it('lists the four Claude models and the five efforts of the issue', () => {
    expect([...CLAUDE_MODELS]).toEqual(['claude-opus-5-5', 'claude-sonnet-5', 'claude-fable-5-1', 'claude-haiku-4-5'])
    expect([...WORKFLOW_EFFORTS]).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  })

  it('carries the five base prompt templates word for word', () => {
    expect(Object.keys(PROMPT_TEMPLATES)).toEqual(['spec', 'plan', 'build', 'review', 'ship'])
    expect(PROMPT_TEMPLATES.review).toBe(
      'Read the diff as a reviewer: bugs, security, readability, missing tests. One line per finding, with file and line. Do not change the code.',
    )
    expect(PROMPT_TEMPLATES.ship).toBe(
      'Rebase on the integration branch and run the full gate again. Open the MR as a draft with a symptom / cause / what changes description.',
    )
  })
})

describe('withProvider', () => {
  it('keeps a Claude model and effort when the provider stays Claude', () => {
    expect(withProvider(draftOf(COLUMN), 'claude')).toMatchObject({ model: 'claude-fable-5-1', effort: 'xhigh' })
  })

  it('leaves the model to the CLI for Codex and drops the sub-agent', () => {
    expect(withProvider(draftOf(COLUMN), 'codex')).toMatchObject({
      provider: 'codex',
      model: '',
      effort: 'xhigh',
      agentName: '',
      command: '/speckit.plan',
    })
  })

  it('clears everything an agent needs when the step becomes human', () => {
    expect(withProvider(draftOf(COLUMN), 'human')).toMatchObject({
      provider: 'human',
      model: '',
      effort: '',
      agentName: '',
      command: '',
      autoStart: false,
    })
  })

  it('gives a default model and effort back when a human step turns into an agent step', () => {
    const human = withProvider(draftOf(COLUMN), 'human')

    expect(withProvider(human, 'claude')).toMatchObject({ model: 'claude-sonnet-5', effort: 'high' })
  })

  it('always produces a draft the API accepts', () => {
    for (const provider of ['claude', 'codex', 'human'] as const) {
      expect(workflowColumnDraftSchema.safeParse(withProvider(draftOf(COLUMN), provider)).success).toBe(true)
    }
  })
})

describe('starterSteps', () => {
  it('offers the five templates in order, each with its own base prompt, valid for the API', () => {
    const steps = starterSteps((template) => template.toUpperCase())

    expect(steps.map((step) => step.label)).toEqual(['SPEC', 'PLAN', 'BUILD', 'REVIEW', 'SHIP'])
    expect(steps.map((step) => step.preprompt)).toEqual(Object.values(PROMPT_TEMPLATES))
    expect(steps.every((step) => workflowColumnDraftSchema.safeParse(step).success)).toBe(true)
  })

  it('starts an agent on entry to the first step only', () => {
    expect(starterSteps((template) => template).map((step) => step.autoStart)).toEqual([true, false, false, false, false])
  })
})

describe('templateOfPrompt', () => {
  it('recognises an untouched template and nothing else', () => {
    expect(templateOfPrompt(PROMPT_TEMPLATES.plan)).toBe('plan')
    expect(templateOfPrompt(`${PROMPT_TEMPLATES.plan} more`)).toBe('')
  })
})

describe('isDirty', () => {
  it('tells an edited step from a saved one', () => {
    expect(isDirty(draftOf(COLUMN), draftOf(COLUMN))).toBe(false)
    expect(isDirty(draftOf(COLUMN), { ...draftOf(COLUMN), effort: 'low' })).toBe(true)
  })
})

describe('keysAfterMove', () => {
  it('moves a step by one place', () => {
    expect(keysAfterMove(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(keysAfterMove(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  it('refuses to move past either end', () => {
    expect(keysAfterMove(['a', 'b'], 'a', -1)).toBeNull()
    expect(keysAfterMove(['a', 'b'], 'b', 1)).toBeNull()
  })
})

describe('summaryOf', () => {
  it('names the model, effort and command of an agent step', () => {
    expect(summaryOf(COLUMN)).toEqual(['fable-5-1', 'xhigh', '/speckit.plan'])
  })

  it('has nothing to say about a human step', () => {
    expect(summaryOf({ ...COLUMN, ...withProvider(draftOf(COLUMN), 'human') })).toEqual([])
  })
})

describe('colourInputValue', () => {
  it('turns a palette token into a hex value for the colour input', () => {
    expect(colourInputValue('info')).toBe('#2563EB')
    expect(colourInputValue('#112233')).toBe('#112233')
    expect(colourInputValue('mystery')).toBe('#6B7280')
  })
})

describe('newStep', () => {
  it('starts as a Claude step with a default model and effort', () => {
    expect(newStep('Triage')).toMatchObject({ label: 'Triage', provider: 'claude', model: 'claude-sonnet-5', effort: 'high' })
  })
})

describe('failureOf', () => {
  it('says the admin is needed on a 403', () => {
    expect(failureOf(new BoardRequestError(403, 'WorkflowNeedsTheProjectAdmin', 'x')).key).toBe(
      'workflowSettings.failure.WorkflowNeedsTheProjectAdmin',
    )
  })

  it('says the step still holds stories on a 409', () => {
    expect(failureOf(new BoardRequestError(409, 'WorkflowColumnInUseError', 'x')).key).toBe(
      'workflowSettings.failure.WorkflowColumnInUseError',
    )
  })

  it('names the refusal of a 422', () => {
    expect(failureOf(new BoardRequestError(422, 'WorkflowColumnRefused', 'DuplicateLabel')).key).toBe(
      'workflowSettings.refusal.DuplicateLabel',
    )
  })
})
