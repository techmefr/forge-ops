import { z } from 'zod'

export const BEHAVIOURAL_KIND_SEQUENCE = ['ordinary', 'human_wait', 'review_gate', 'ship'] as const

export type BehaviouralKind = (typeof BEHAVIOURAL_KIND_SEQUENCE)[number]

export const WORKFLOW_PROVIDERS = ['claude', 'codex', 'human'] as const

export type WorkflowProvider = (typeof WORKFLOW_PROVIDERS)[number]

export const CLAUDE_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5',
  'claude-fable-5-1',
  'claude-haiku-4-5',
] as const

export const WORKFLOW_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type WorkflowEffort = (typeof WORKFLOW_EFFORTS)[number]

export const CLI_DEFAULT_MODEL = ''

export const NO_EFFORT = ''

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5'

export const DEFAULT_EFFORT: WorkflowEffort = 'high'

export const RESERVED_STEP_LABELS: readonly string[] = ['backlog', 'done']

export function modelsOfProvider(provider: WorkflowProvider): readonly string[] {
  return provider === 'claude' ? CLAUDE_MODELS : [CLI_DEFAULT_MODEL]
}

export function acceptsEffort(provider: WorkflowProvider): boolean {
  return provider !== 'human'
}

export const PROMPT_TEMPLATE_KEYS = ['spec', 'plan', 'build', 'review', 'ship'] as const

export type PromptTemplateKey = (typeof PROMPT_TEMPLATE_KEYS)[number]

export const PROMPT_TEMPLATES: Readonly<Record<PromptTemplateKey, string>> = {
  spec: "Read the epic and its links (the project's speckit, graphify). Write the story spec with /speckit.specify: goal, acceptance criteria, out of scope. List the open questions and wait for the answers before concluding.",
  plan: 'Start from the approved spec. Propose a plan in short steps, each testable, with the files touched. Flag the risks and the dependencies on other stories.',
  build:
    'Follow the approved plan. Write the failing test first, then the code, one commit per step (conventional commits). Run the targeted tests before handing back.',
  review:
    'Read the diff as a reviewer: bugs, security, readability, missing tests. One line per finding, with file and line. Do not change the code.',
  ship: 'Rebase on the integration branch and run the full gate again. Open the MR as a draft with a symptom / cause / what changes description.',
}

export const workflowColumnDraftSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    colour: z.string().regex(/^(#[0-9a-fA-F]{6}|[a-z][a-z0-9]*)$/),
    provider: z.enum(WORKFLOW_PROVIDERS),
    model: z.string().max(80),
    effort: z.union([z.enum(WORKFLOW_EFFORTS), z.literal(NO_EFFORT)]),
    agentName: z.string().trim().max(120),
    command: z.string().trim().max(200),
    preprompt: z.string().max(8000),
    autoStart: z.boolean(),
  })
  .strict()

export type WorkflowColumnDraft = z.infer<typeof workflowColumnDraftSchema>

export const workflowColumnOrderSchema = z.object({ keysInOrder: z.array(z.string().min(1)).min(1) }).strict()

export type WorkflowColumn = WorkflowColumnDraft & {
  id: number
  projectId: number
  key: string
  position: number
  behaviouralKind: BehaviouralKind
}

export type WorkflowAdmin = {
  login: string
  name: string
}

export type ProjectWorkflow = {
  columns: readonly WorkflowColumn[]
  maySettle: boolean
  admin: WorkflowAdmin | null
}
