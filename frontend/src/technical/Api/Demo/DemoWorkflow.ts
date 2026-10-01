import { DEFAULT_STEP_RETRIES } from '@contract/AutopilotContract'
import {
  RESERVED_STEP_LABELS,
  WORKFLOW_EFFORTS,
  WORKFLOW_PROVIDERS,
  acceptsEffort,
  modelsOfProvider,
  type WorkflowColumn,
  type WorkflowColumnDraft,
  type WorkflowEffort,
  type WorkflowProvider,
} from '@contract/WorkflowColumnContract'
import {
  adminOf,
  identifierAt,
  nextIdentifier,
  refusal,
  reply,
  route,
  type DemoContext,
  type DemoReply,
  type DemoRoute,
  type DemoState,
} from './DemoModel'

export function columnsOf(state: DemoState, projectId: number): WorkflowColumn[] {
  return state.columns
    .filter((column) => column.projectId === projectId)
    .sort((one, other) => one.position - other.position)
}

function mayAdminister(state: DemoState, projectId: number): boolean {
  return state.self.superAdmin || adminOf(state, projectId)?.login === state.self.login
}

function keyOf(label: string, taken: readonly string[]): string {
  const slug =
    label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'step'
  let candidate = slug
  let suffix = 2
  while (taken.includes(candidate)) {
    candidate = `${slug}_${suffix}`
    suffix += 1
  }
  return candidate
}

function draftOf(body: Record<string, unknown>): WorkflowColumnDraft {
  const text = (key: string): string => (typeof body[key] === 'string' ? (body[key] as string) : '')
  return {
    label: text('label').trim(),
    colour: text('colour') === '' ? 'acc' : text('colour'),
    provider: text('provider') as WorkflowProvider,
    model: text('model'),
    effort: text('effort') as WorkflowColumnDraft['effort'],
    agentName: text('agentName').trim(),
    command: text('command').trim(),
    preprompt: text('preprompt'),
    autoStart: body.autoStart === true,
  }
}

function refusalOfDraft(draft: WorkflowColumnDraft, otherLabels: readonly string[]): DemoReply | null {
  const refused = (reason: string): DemoReply => refusal(422, 'WorkflowColumnRefused', reason)
  if (draft.label === '') {
    return refused('EmptyLabel')
  }
  if (RESERVED_STEP_LABELS.includes(draft.label.toLowerCase())) {
    return refused('ReservedLabel')
  }
  if (otherLabels.some((other) => other.trim().toLowerCase() === draft.label.toLowerCase())) {
    return refused('DuplicateLabel')
  }
  if (!(WORKFLOW_PROVIDERS as readonly string[]).includes(draft.provider)) {
    return refusal(422, 'InvalidWorkflowColumn', 'Unknown provider')
  }
  if (!modelsOfProvider(draft.provider).includes(draft.model)) {
    return refused('ModelNotOfProvider')
  }
  const effortAllowed = acceptsEffort(draft.provider)
    ? (WORKFLOW_EFFORTS as readonly string[]).includes(draft.effort as WorkflowEffort)
    : draft.effort === ''
  if (!effortAllowed) {
    return refused('EffortNotOfProvider')
  }
  return draft.provider === 'human' && draft.autoStart ? refused('HumanStepCannotAutoStart') : null
}

function guarded(context: DemoContext, work: (projectId: number) => DemoReply): DemoReply {
  const projectId = identifierAt(context)
  if (!context.state.projects.some((project) => project.id === projectId)) {
    return refusal(404, 'ProjectNotFound', 'This project does not exist')
  }
  if (!mayAdminister(context.state, projectId)) {
    return refusal(403, 'WorkflowNeedsTheProjectAdmin', 'Only the project admin can change the steps')
  }
  return work(projectId)
}

function addColumn(current: DemoState, projectId: number, draft: WorkflowColumnDraft): WorkflowColumn {
  const taken = columnsOf(current, projectId)
  const column: WorkflowColumn = {
    ...draft,
    maxRetries: draft.maxRetries ?? DEFAULT_STEP_RETRIES,
    id: nextIdentifier(current),
    projectId,
    key: keyOf(
      draft.label,
      taken.map((held) => held.key),
    ),
    position: taken.length + 1,
    behaviouralKind: draft.provider === 'human' ? 'human_wait' : 'ordinary',
  }
  current.columns.push(column)
  return column
}

export const WORKFLOW_ROUTES: readonly DemoRoute[] = [
  route('GET', '/api/projects/(\\d+)/workflow-columns', (context) => {
    const projectId = identifierAt(context)
    return reply({
      columns: columnsOf(context.state, projectId),
      maySettle: mayAdminister(context.state, projectId),
      admin: adminOf(context.state, projectId),
    })
  }),
  route('POST', '/api/projects/(\\d+)/workflow-columns', (context) =>
    guarded(context, (projectId) => {
      const draft = draftOf(context.body)
      const refused = refusalOfDraft(
        draft,
        columnsOf(context.state, projectId).map((column) => column.label),
      )
      return refused ?? reply(addColumn(context.state, projectId, draft), 201)
    }),
  ),
  route('PUT', '/api/projects/(\\d+)/workflow-columns/order', (context) =>
    guarded(context, (projectId) => {
      const keys = Array.isArray(context.body.keysInOrder) ? (context.body.keysInOrder as string[]) : []
      const held = columnsOf(context.state, projectId)
      if (keys.length !== held.length || !held.every((column) => keys.includes(column.key))) {
        return refusal(422, 'WorkflowColumnRefused', 'OrderMismatch')
      }
      for (const column of held) {
        column.position = keys.indexOf(column.key) + 1
      }
      return reply(columnsOf(context.state, projectId))
    }),
  ),
  route('PUT', '/api/projects/(\\d+)/workflow-columns/(\\d+)', (context) =>
    guarded(context, (projectId) => {
      const column = context.state.columns.find(
        (held) => held.projectId === projectId && held.id === Number(context.match[2]),
      )
      if (column === undefined) {
        return refusal(404, 'WorkflowColumnNotFoundError', 'This step does not exist')
      }
      const draft = draftOf(context.body)
      const refused = refusalOfDraft(
        draft,
        columnsOf(context.state, projectId)
          .filter((held) => held.id !== column.id)
          .map((held) => held.label),
      )
      if (refused !== null) {
        return refused
      }
      Object.assign(column, draft, { behaviouralKind: draft.provider === 'human' ? 'human_wait' : column.behaviouralKind })
      return reply(column)
    }),
  ),
  route('DELETE', '/api/projects/(\\d+)/workflow-columns/(\\d+)', (context) =>
    guarded(context, (projectId) => {
      const column = context.state.columns.find(
        (held) => held.projectId === projectId && held.id === Number(context.match[2]),
      )
      if (column === undefined) {
        return refusal(404, 'WorkflowColumnNotFoundError', 'This step does not exist')
      }
      if (context.state.cards.some((card) => card.projectId === projectId && card.stepKey === column.key)) {
        return refusal(409, 'WorkflowColumnInUseError', 'Cards sit in this step')
      }
      context.state.columns = context.state.columns.filter((held) => held.id !== column.id)
      columnsOf(context.state, projectId).forEach((held, index) => {
        held.position = index + 1
      })
      return reply(null, 204)
    }),
  ),
]
