export type StoryKind = 'functional' | 'test'

export type StoryState =
  | 'drafting'
  | 'backlog'
  | 'architecture'
  | 'plan_review'
  | 'building'
  | 'gating'
  | 'reviewing'
  | 'shipping'
  | 'flagged'
  | 'done'
  | 'escalated'

export type KanbanColumn = {
  key: StoryState
  label: string
  colour: string
}

export type Project = {
  id: number
  slug: string
  name: string
  repositoryUrl: string
  integrationBranch: string
  colour: string
}

export type Epic = {
  id: number
  projectId: number
  title: string
  businessIntent: string
}

export type Story = {
  id: number
  epicId: number
  twinOfStoryId: number | null
  reference: string
  title: string
  body: string
  kind: StoryKind
  state: StoryState
  points: number | null
  rolloutPercent: number | null
  mergeConflict: boolean
  escalationReason: string | null
}

export type SessionUsage = {
  costUsd: number
  inputTokens: number
  outputTokens: number
}

export type KanbanStory = Story & {
  usage: SessionUsage
  blockers: readonly string[]
}

export type Criterion = {
  id: number
  storyId: number
  reference: string
  statement: string
  persona: string | null
  expectsRefusal: boolean
  evidencePath: string | null
  satisfied: boolean
}

export type CheckpointName =
  | 'spec_done'
  | 'arch_done'
  | 'tests_written'
  | 'build_done'
  | 'verified'
  | 'reviewed'

export type DefinitionOfDoneStep = {
  name: CheckpointName
  proven: boolean
  evidencePath: string | null
}

export type ReviewLens = 'quality' | 'security' | 'accessibility'

export type ReviewPass = {
  lens: ReviewLens
  state: 'pending' | 'running' | 'passed'
  agentName: string | null
}

export type ReviewFinding = {
  id: number
  storyId: number
  lens: ReviewLens
  severity: 'strong' | 'weak'
  path: string
  statement: string
}

export type Completeness = {
  score: number
  launchable: boolean
  gaps: readonly string[]
}

export type Ticket = {
  functional: Story
  tests: Story | null
  criteria: readonly Criterion[]
  dod: readonly DefinitionOfDoneStep[]
  cascade: readonly ReviewPass[]
  blockers: readonly string[]
  completeness: Completeness
}

export type Zone = {
  id: number
  projectId: number
  pathPrefix: string
  name: string
  colour: string
  summary: string | null
}

export type ZoneFile = {
  path: string
  storyReference: string
  agentName: string | null
}

export type ZoneOverview = {
  zone: Zone
  files: readonly ZoneFile[]
  storyCount: number
}

export type PathConflict = {
  path: string
  storyIds: readonly number[]
}

export type Worktree = {
  id: number
  storyId: number
  storyReference: string
  path: string
  branch: string
  baseRef: string
  baseSha: string
  port: number
  subdomain: string
  createdAt: string
}

export type MergeCleanup = {
  scopesReleased: number
  worktreeClosed: boolean
  worktreeRefusal: string | null
}

export type ScopeReservation = {
  id: number
  storyId: number
  storyReference: string
  pathPrefix: string
  symbols: readonly string[]
  reservedAt: string
}

export type ScopeCollision = {
  storyIds: readonly number[]
  reason: string
}

export type CostCapConduct = 'stop' | 'downgrade' | 'reroute'

export type BudgetPolicy = {
  capUsd: number
  conduct: CostCapConduct
  downgradeModel: string
  rerouteBaseUrl: string | null
}

export type BudgetSettings = {
  policy: BudgetPolicy
  spentUsd: number
}

export type IncidentOrigin = {
  id: number
  slug: string
  name: string
  kind: 'sentry' | 'user_report' | 'idea' | 'manual'
}

export type Incident = {
  id: number
  originId: number
  fingerprint: string
  title: string
  detail: string
  occurrences: number
  state: 'pending' | 'accepted' | 'refused'
  storyId: number | null
  refusalReason: string | null
}

export type AgentPhase = 'spec' | 'architecture' | 'tdd' | 'code' | 'gate' | 'review' | 'ship'

export type SessionHistoryEntry = {
  id: number
  storyId: number
  storyReference: string
  phase: AgentPhase
  agentName: string
  lifecycle: string
  outcome: string | null
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
  startedAt: string
  endedAt: string | null
  seconds: number | null
}

export type BoardStatistics = {
  sessions: number
  totalCostUsd: number
  totalSeconds: number
  agents: readonly { agentName: string; sessions: number; totalSeconds: number; totalCostUsd: number }[]
  phases: readonly { phase: AgentPhase; sessions: number; totalSeconds: number }[]
  outcomes: readonly { outcome: string; sessions: number }[]
}

export type FleetJob = {
  id: string
  state: string
  cwd: string | null
  sessionId: string | null
  name: string | null
  intent: string | null
  tokens: number | null
  cliVersion: string | null
  updatedAt: string | null
}

export type Fleet = {
  roster: { supervisorPid: number | null; updatedAt: number | null; workerCount: number } | null
  jobs: readonly FleetJob[]
}

export type ReportFact =
  | { kind: 'checkpoint'; statement: string; evidencePath: string }
  | { kind: 'criterion'; statement: string; evidencePath: string }
  | { kind: 'cost'; statement: string; costUsd: number; inputTokens: number; outputTokens: number }

export type ReportJudgement =
  | { kind: 'finding'; statement: string; lens: string; severity: string; path: string }
  | { kind: 'criterion_unmet'; statement: string; reference: string }
  | { kind: 'blocker'; statement: string; reference: string }

export type StoryReport = {
  facts: readonly ReportFact[]
  judgements: readonly ReportJudgement[]
}
