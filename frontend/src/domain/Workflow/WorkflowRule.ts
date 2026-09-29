import {
  CLI_DEFAULT_MODEL,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_EFFORT,
  NO_EFFORT,
  PROMPT_TEMPLATES,
  WORKFLOW_EFFORTS,
  modelsOfProvider,
  type PromptTemplateKey,
  type WorkflowColumn,
  type WorkflowColumnDraft,
  type WorkflowProvider,
} from '@contract/WorkflowColumnContract'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import { reasonOf } from '@/technical/Api/UseResource'

const TOKEN_COLOURS: Readonly<Record<string, string>> = {
  acc: '#0F9D8A',
  info: '#2563EB',
  warn: '#EA8A2B',
  violet: '#7C3AED',
  orange: '#EA8A2B',
  green: '#16A34A',
  red: '#DC2626',
  line: '#6B7280',
}

const FALLBACK_COLOUR = '#6B7280'

const STARTER_STEPS: readonly { template: PromptTemplateKey; colour: string; command: string; model: string }[] = [
  { template: 'spec', colour: '#7C3AED', command: '/speckit.specify', model: 'claude-opus-5-5' },
  { template: 'plan', colour: '#2563EB', command: '/speckit.plan', model: 'claude-opus-5-5' },
  { template: 'build', colour: '#0F9D8A', command: '', model: DEFAULT_CLAUDE_MODEL },
  { template: 'review', colour: '#EA8A2B', command: '', model: DEFAULT_CLAUDE_MODEL },
  { template: 'ship', colour: '#16A34A', command: '', model: DEFAULT_CLAUDE_MODEL },
]

export function colourInputValue(colour: string): string {
  return colour.startsWith('#') ? colour : (TOKEN_COLOURS[colour] ?? FALLBACK_COLOUR)
}

export function draftOf(column: WorkflowColumn): WorkflowColumnDraft {
  return {
    label: column.label,
    colour: column.colour,
    provider: column.provider,
    model: column.model,
    effort: column.effort,
    agentName: column.agentName,
    command: column.command,
    preprompt: column.preprompt,
    autoStart: column.autoStart,
  }
}

export function isDirty(saved: WorkflowColumnDraft, edited: WorkflowColumnDraft): boolean {
  return JSON.stringify(saved) !== JSON.stringify(edited)
}

export function withProvider(draft: WorkflowColumnDraft, provider: WorkflowProvider): WorkflowColumnDraft {
  if (provider === 'human') {
    return { ...draft, provider, model: CLI_DEFAULT_MODEL, effort: NO_EFFORT, agentName: '', command: '', autoStart: false }
  }
  const knownEffort = WORKFLOW_EFFORTS.find((effort) => effort === draft.effort) ?? DEFAULT_EFFORT
  if (provider === 'codex') {
    return { ...draft, provider, model: CLI_DEFAULT_MODEL, effort: knownEffort, agentName: '' }
  }
  const model = modelsOfProvider('claude').includes(draft.model) ? draft.model : DEFAULT_CLAUDE_MODEL
  return { ...draft, provider, model, effort: knownEffort }
}

export function newStep(label: string): WorkflowColumnDraft {
  return {
    label,
    colour: '#0F9D8A',
    provider: 'claude',
    model: DEFAULT_CLAUDE_MODEL,
    effort: DEFAULT_EFFORT,
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: false,
  }
}

export function starterSteps(labelOf: (template: PromptTemplateKey) => string): readonly WorkflowColumnDraft[] {
  return STARTER_STEPS.map((starter) => ({
    ...newStep(labelOf(starter.template)),
    colour: starter.colour,
    model: starter.model,
    command: starter.command,
    preprompt: PROMPT_TEMPLATES[starter.template],
    autoStart: starter.template === 'spec',
  }))
}

export function templateOfPrompt(preprompt: string): PromptTemplateKey | '' {
  const found = (Object.entries(PROMPT_TEMPLATES) as [PromptTemplateKey, string][]).find(
    ([, text]) => text === preprompt,
  )
  return found === undefined ? '' : found[0]
}

export function keysAfterMove(keys: readonly string[], key: string, direction: -1 | 1): readonly string[] | null {
  const index = keys.indexOf(key)
  const target = index + direction
  if (index < 0 || target < 0 || target >= keys.length) {
    return null
  }
  const moved = [...keys]
  moved.splice(index, 1)
  moved.splice(target, 0, key)
  return moved
}

export function summaryOf(column: WorkflowColumn): readonly string[] {
  if (column.provider === 'human') {
    return []
  }
  const model = column.model === '' ? '' : column.model.replace(/^claude-/, '')
  return [model, column.effort, column.command].filter((part) => part !== '')
}

const PROVIDER_KEYS: Readonly<Record<WorkflowProvider, string>> = {
  claude: 'workflowSettings.providerClaude',
  codex: 'workflowSettings.providerCodex',
  human: 'workflowSettings.providerHuman',
}

const TEMPLATE_KEYS: Readonly<Record<PromptTemplateKey, string>> = {
  spec: 'workflowSettings.template.spec',
  plan: 'workflowSettings.template.plan',
  build: 'workflowSettings.template.build',
  review: 'workflowSettings.template.review',
  ship: 'workflowSettings.template.ship',
}

const FAILURE_KEYS: Readonly<Record<string, string>> = {
  WorkflowNeedsTheProjectAdmin: 'workflowSettings.failure.WorkflowNeedsTheProjectAdmin',
  WorkflowColumnInUseError: 'workflowSettings.failure.WorkflowColumnInUseError',
  WorkflowColumnNotFoundError: 'workflowSettings.failure.WorkflowColumnNotFoundError',
}

const REFUSAL_KEYS: Readonly<Record<string, string>> = {
  EmptyLabel: 'workflowSettings.refusal.EmptyLabel',
  ReservedLabel: 'workflowSettings.refusal.ReservedLabel',
  DuplicateLabel: 'workflowSettings.refusal.DuplicateLabel',
  ModelNotOfProvider: 'workflowSettings.refusal.ModelNotOfProvider',
  EffortNotOfProvider: 'workflowSettings.refusal.EffortNotOfProvider',
  HumanStepCannotAutoStart: 'workflowSettings.refusal.HumanStepCannotAutoStart',
  OrderMismatch: 'workflowSettings.refusal.OrderMismatch',
}

export function providerLabelKey(provider: WorkflowProvider): string {
  return PROVIDER_KEYS[provider]
}

export function templateLabelKey(template: PromptTemplateKey): string {
  return TEMPLATE_KEYS[template]
}

export function failureOf(error: unknown): Phrase {
  if (error instanceof BoardRequestError) {
    const failure = FAILURE_KEYS[error.code]
    if (failure !== undefined) {
      return phrase(failure)
    }
    const refusal = error.code === 'WorkflowColumnRefused' ? REFUSAL_KEYS[error.message] : undefined
    if (refusal !== undefined) {
      return phrase(refusal)
    }
    if (error.status === 422) {
      return phrase('workflowSettings.failure.Invalid')
    }
  }
  return reasonOf(error)
}
