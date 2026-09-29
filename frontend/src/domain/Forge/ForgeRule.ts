import {
  BACKLOG_STEP_KEY,
  DONE_STEP_KEY,
  type ForgeCardStatus,
  type ForgeCardView,
} from '@contract/ForgeCardContract'
import type { WorkflowColumn } from '@contract/WorkflowColumnContract'

export const FORGE_VIEWS = ['kanban', 'pipeline'] as const

export type ForgeView = (typeof FORGE_VIEWS)[number]

export const DEFAULT_FORGE_VIEW: ForgeView = 'kanban'

export const FORGE_VIEW_KEY = 'forge.forgeView'

export const FORGE_PROJECT_KEY = 'forge.forgeProject'

export type StepKind = 'backlog' | 'step' | 'done'

export type BoardStep = {
  key: string
  kind: StepKind
  label: string
  colour: string
  human: boolean
  auto: boolean
  column: WorkflowColumn | null
}

export type StepLabels = { backlog: string; done: string }

export function boardSteps(columns: readonly WorkflowColumn[], labels: StepLabels): readonly BoardStep[] {
  return [
    {
      key: BACKLOG_STEP_KEY,
      kind: 'backlog',
      label: labels.backlog,
      colour: 'txtlow',
      human: false,
      auto: false,
      column: null,
    },
    ...columns.map(
      (column): BoardStep => ({
        key: column.key,
        kind: 'step',
        label: column.label,
        colour: column.colour,
        human: column.provider === 'human',
        auto: column.autoStart && column.provider !== 'human',
        column,
      }),
    ),
    {
      key: DONE_STEP_KEY,
      kind: 'done',
      label: labels.done,
      colour: 'green',
      human: false,
      auto: false,
      column: null,
    },
  ]
}

export function cardsOfStep(cards: readonly ForgeCardView[], key: string): readonly ForgeCardView[] {
  return cards.filter((card) => card.stepKey === key)
}

export function filterBySubject(cards: readonly ForgeCardView[], subjectId: number | null): readonly ForgeCardView[] {
  return subjectId === null ? cards : cards.filter((card) => card.subjectId === subjectId)
}

export function canDropInto(card: ForgeCardView, target: BoardStep): boolean {
  if (card.stepKey === target.key) {
    return false
  }
  if (card.stepKey === DONE_STEP_KEY || target.kind === 'done') {
    return false
  }
  return card.status !== 'running'
}

export function adjacentStep(
  steps: readonly BoardStep[],
  card: ForgeCardView,
  direction: -1 | 1,
): BoardStep | null {
  const index = steps.findIndex((step) => step.key === card.stepKey)
  const target = steps[index + direction]
  if (index === -1 || target === undefined) {
    return null
  }
  return canDropInto(card, target) ? target : null
}

export const DOT_STATES = [
  'passed',
  'running',
  'failed',
  'to_validate',
  'human_review',
  'waiting',
  'to_come',
] as const

export type DotState = (typeof DOT_STATES)[number]

export function dotStateOfStatus(status: ForgeCardStatus): DotState {
  if (status === 'idle') {
    return 'waiting'
  }
  return status === 'done' ? 'passed' : status
}

export type Dot = {
  key: string
  label: string
  state: DotState
}

export function dotsOf(card: ForgeCardView, steps: readonly BoardStep[]): readonly Dot[] {
  const inner = steps.filter((step) => step.kind === 'step')
  const current = inner.findIndex((step) => step.key === card.stepKey)
  return inner.map((step, index): Dot => {
    if (card.stepKey === DONE_STEP_KEY) {
      return { key: step.key, label: step.label, state: 'passed' }
    }
    if (current === -1 || index > current) {
      return { key: step.key, label: step.label, state: 'to_come' }
    }
    if (index < current) {
      return { key: step.key, label: step.label, state: 'passed' }
    }
    return { key: step.key, label: step.label, state: dotStateOfStatus(card.status) }
  })
}

const PIPELINE_RANK: Readonly<Record<ForgeCardStatus, number>> = {
  running: 0,
  failed: 1,
  to_validate: 2,
  human_review: 3,
  idle: 5,
  done: 9,
}

function rankOf(card: ForgeCardView): number {
  if (card.stepKey === BACKLOG_STEP_KEY) {
    return 8
  }
  return PIPELINE_RANK[card.status]
}

export function pipelineOrder(cards: readonly ForgeCardView[]): readonly ForgeCardView[] {
  return [...cards].sort((left, right) => rankOf(left) - rankOf(right) || left.id - right.id)
}

export const CARD_ACTIONS = ['launch', 'retry', 'validate', 'stop'] as const

export type CardAction = (typeof CARD_ACTIONS)[number]

export const STORY_GAP_CODES = [
  'TitleTooShort',
  'BodyTooShort',
  'BodyWithoutNeed',
  'CriteriaMissing',
  'TwinMissing',
] as const

export function gapCodesOf(detail: Readonly<Record<string, unknown>>): readonly string[] {
  const codes = detail.gapCodes
  if (!Array.isArray(codes)) {
    return []
  }
  return codes.filter(
    (code): code is string => typeof code === 'string' && (STORY_GAP_CODES as readonly string[]).includes(code),
  )
}

export const FORGE_FAILURE_CODES = [
  'StepBusyError',
  'DoneIsEarnedError',
  'DoneIsFinalError',
  'UnknownStepKeyError',
  'LaunchNeedsAStepError',
  'HumanStepError',
  'StoryTooThinError',
  'PhaseNotReadyError',
  'SessionAlreadyRunningError',
  'FleetSaturatedError',
  'BudgetExhaustedError',
  'StoryBlockedError',
  'NotAtLastStepError',
] as const

export function primaryActionOf(card: ForgeCardView, steps: readonly BoardStep[]): CardAction | null {
  if (card.stepKey === DONE_STEP_KEY) {
    return null
  }
  if (card.stepKey === BACKLOG_STEP_KEY) {
    return steps.some((step) => step.kind === 'step') ? 'launch' : null
  }
  if (card.status === 'running') {
    return 'stop'
  }
  if (card.status === 'failed') {
    return 'retry'
  }
  if (card.status === 'to_validate' || card.status === 'human_review') {
    return adjacentStep(steps, card, 1) === null && !isLastStep(steps, card) ? null : 'validate'
  }
  const step = steps.find((candidate) => candidate.key === card.stepKey)
  return step?.human === true ? null : 'launch'
}

export function firstStepKey(steps: readonly BoardStep[]): string | null {
  return steps.find((step) => step.kind === 'step')?.key ?? null
}

export function minutesOf(seconds: number): number {
  return Math.round(seconds / 60)
}

export function activeProjectOf(
  projects: readonly { id: number }[],
  remembered: string,
): number | null {
  const wanted = Number(remembered)
  return projects.find((project) => project.id === wanted)?.id ?? projects[0]?.id ?? null
}

export function referenceLabel(card: { storyReference: string; reference: string }): string {
  return card.storyReference === card.reference
    ? card.reference
    : `${card.storyReference} · ${card.reference}`
}

export function isLastStep(steps: readonly BoardStep[], card: ForgeCardView): boolean {
  const real = steps.filter((step) => step.kind === 'step')
  return real.length > 0 && real[real.length - 1]?.key === card.stepKey
}
