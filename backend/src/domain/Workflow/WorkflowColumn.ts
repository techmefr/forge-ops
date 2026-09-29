import {
  acceptsEffort,
  modelsOfProvider,
  RESERVED_STEP_LABELS,
  WORKFLOW_EFFORTS,
  type BehaviouralKind,
  type WorkflowColumnDraft,
  type WorkflowEffort,
} from '../../../../contract/WorkflowColumnContract.js'

export type WorkflowColumnRefusal =
  | { reason: 'EmptyLabel' }
  | { reason: 'ReservedLabel'; label: string }
  | { reason: 'DuplicateLabel'; label: string }
  | { reason: 'ModelNotOfProvider'; provider: string; model: string }
  | { reason: 'EffortNotOfProvider'; provider: string; effort: string }
  | { reason: 'HumanStepCannotAutoStart' }
  | { reason: 'OrderMismatch' }

export function refusalOfDraft(
  draft: WorkflowColumnDraft,
  otherLabels: readonly string[],
): WorkflowColumnRefusal | null {
  const label = draft.label.trim()
  if (label === '') {
    return { reason: 'EmptyLabel' }
  }
  if (RESERVED_STEP_LABELS.includes(label.toLowerCase())) {
    return { reason: 'ReservedLabel', label }
  }
  if (otherLabels.some((other) => other.trim().toLowerCase() === label.toLowerCase())) {
    return { reason: 'DuplicateLabel', label }
  }
  if (!modelsOfProvider(draft.provider).includes(draft.model)) {
    return { reason: 'ModelNotOfProvider', provider: draft.provider, model: draft.model }
  }
  const effortAllowed = acceptsEffort(draft.provider)
    ? WORKFLOW_EFFORTS.includes(draft.effort as WorkflowEffort)
    : draft.effort === ''
  if (!effortAllowed) {
    return { reason: 'EffortNotOfProvider', provider: draft.provider, effort: draft.effort }
  }
  if (draft.provider === 'human' && draft.autoStart) {
    return { reason: 'HumanStepCannotAutoStart' }
  }
  return null
}

export function behaviouralKindOf(draft: WorkflowColumnDraft): BehaviouralKind {
  return draft.provider === 'human' ? 'human_wait' : 'ordinary'
}

const SLUG_FALLBACK = 'step'

export function keyOfLabel(label: string, takenKeys: readonly string[]): string {
  const slug =
    label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || SLUG_FALLBACK
  if (!takenKeys.includes(slug)) {
    return slug
  }
  let suffix = 2
  while (takenKeys.includes(`${slug}_${suffix}`)) {
    suffix += 1
  }
  return `${slug}_${suffix}`
}
