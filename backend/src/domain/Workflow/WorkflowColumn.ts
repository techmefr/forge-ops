import type { BehaviouralKind, WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import { BEHAVIOURAL_KIND_SEQUENCE } from '../../../../contract/WorkflowColumnContract.js'

export const SEED_WORKFLOW_COLUMNS: readonly WorkflowColumnDraft[] = [
  { key: 'backlog', label: 'Reserve', colour: 'line', agentName: 'architecte', command: 'SPEC.md', preprompt: '', behaviouralKind: 'ordinary' },
  { key: 'architecture', label: 'Plan', colour: 'info', agentName: 'architecte', command: 'PLAN.md', preprompt: '', behaviouralKind: 'ordinary' },
  { key: 'plan_review', label: 'Plan a valider', colour: 'warn', agentName: '', command: '', preprompt: '', behaviouralKind: 'human_wait' },
  { key: 'building', label: 'Dev', colour: 'acc', agentName: 'trinity', command: 'BUILD.md', preprompt: '', behaviouralKind: 'ordinary' },
  { key: 'gating', label: 'Test', colour: 'info', agentName: 'galadriel', command: 'VERIFY.md', preprompt: '', behaviouralKind: 'ordinary' },
  { key: 'reviewing', label: 'Review', colour: 'violet', agentName: 'elrond', command: 'REVIEW.md', preprompt: '', behaviouralKind: 'review_gate' },
  { key: 'shipping', label: 'Merge', colour: 'orange', agentName: 'gandalf', command: 'SHIP.md', preprompt: '', behaviouralKind: 'ship' },
  { key: 'flagged', label: 'Feature flag', colour: 'violet', agentName: '', command: '', preprompt: '', behaviouralKind: 'human_wait' },
  { key: 'done', label: 'Prod', colour: 'green', agentName: '', command: '', preprompt: '', behaviouralKind: 'human_wait' },
]

export type WorkflowColumnRefusal =
  | { reason: 'EmptyLabel' }
  | { reason: 'EmptyKey' }
  | { reason: 'DuplicateKey'; key: string }
  | { reason: 'UnknownBehaviouralKind'; behaviouralKind: string }
  | { reason: 'MissingAgentForOrdinaryColumn'; key: string }

export function refusalOfDraft(
  draft: WorkflowColumnDraft,
  existingKeys: readonly string[],
): WorkflowColumnRefusal | null {
  if (draft.key.trim() === '') {
    return { reason: 'EmptyKey' }
  }
  if (draft.label.trim() === '') {
    return { reason: 'EmptyLabel' }
  }
  if (existingKeys.includes(draft.key)) {
    return { reason: 'DuplicateKey', key: draft.key }
  }
  if (!BEHAVIOURAL_KIND_SEQUENCE.includes(draft.behaviouralKind as BehaviouralKind)) {
    return { reason: 'UnknownBehaviouralKind', behaviouralKind: draft.behaviouralKind }
  }
  if (draft.behaviouralKind !== 'human_wait' && draft.agentName.trim() === '') {
    return { reason: 'MissingAgentForOrdinaryColumn', key: draft.key }
  }
  return null
}
