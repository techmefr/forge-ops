import type { EpicPatch, SubjectLink } from '../../../contract/EpicContract.js'
import type { EventType } from '../../../contract/EventContract.js'
import type { Milestone, MilestoneKind } from '../../../contract/StoryContract.js'
import type { CheckpointName } from '../domain/Checkpoint/Checkpoint.js'
import type { StoryState } from '../domain/Story/Story.js'
import type { AgentPhase } from '../domain/Agent/AgentSession.js'
import type { WorkflowColumnDraft } from '../../../contract/WorkflowColumnContract.js'
import type { SessionExit } from '../domain/Agent/SessionOutcome.js'

export function agentStep(label: string, colour: string, autoStart: boolean): WorkflowColumnDraft {
  return {
    label,
    colour,
    provider: 'claude',
    model: 'claude-sonnet-5',
    effort: 'high',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart,
  }
}

export const DEMO_STEPS: readonly WorkflowColumnDraft[] = [
  agentStep('Architecture', 'acc', true),
  {
    label: 'Plan review',
    colour: 'warn',
    provider: 'human',
    model: '',
    effort: '',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: false,
  },
  agentStep('Building', 'info', false),
  agentStep('Gating', 'orange', false),
  agentStep('Reviewing', 'green', false),
  agentStep('Shipping', 'red', false),
]

export const MILESTONE_SPREAD: readonly { kind: MilestoneKind; inDays: number }[] = [
  { kind: 'demo', inDays: 4 },
  { kind: 'production', inDays: 21 },
  { kind: 'everyone', inDays: 45 },
]

export function milestonesOf(epicId: number, rank: number): readonly Milestone[] {
  const start = Date.now()
  return MILESTONE_SPREAD.map(({ kind, inDays }) => ({
    epicId,
    kind,
    dueOn: new Date(start + (inDays - rank * 6) * 86400000).toISOString().slice(0, 10),
  }))
}

export function dayFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}


export const MARKER = 'demo_seed'
export const CENSUS = { tests: 24, skipped: 1, tautologies: 0 }
export const LENS_AGENTS = { quality: 'elrond', security: 'seraph', accessibility: 'link' } as const
export const LENS_SECONDS = { quality: 540, security: 420, accessibility: 360 } as const
export const LENS_COST = { quality: 0.29, security: 0.24, accessibility: 0.19 } as const
export const LENS_TOKENS = { quality: 42000, security: 35000, accessibility: 28000 } as const

export type StoryPlan = {
  slug: string
  title: string
  body: string
  twinTitle: string
  state: StoryState
  points: number | null
  proven: CheckpointName | null
  criteria: readonly { statement: string; met: boolean }[]
  column?: string
}

export type ProjectPlan = {
  slug: string
  name: string
  colour: string
  epicTitle: string
  epicIntent: string
  stories: readonly StoryPlan[]
  steps?: readonly WorkflowColumnDraft[]
}

export const PROVEN_UP_TO: readonly CheckpointName[] = [
  'spec_done',
  'arch_done',
  'tests_written',
  'build_done',
  'verified',
  'reviewed',
]


export type SpareEpicPlan = {
  project: string
  title: string
  intent: string
  assignee: string | null
  planning?: EpicPatch
  lateByDays?: number
  tags?: readonly string[]
  dependsOn?: readonly string[]
  links?: readonly SubjectLink[]
  deleted?: boolean
}

export const TAG_PLAN: readonly { label: string; colour: string }[] = [
  { label: 'frontend', colour: '#5b8def' },
  { label: 'backend', colour: '#22c55e' },
  { label: 'security', colour: '#ef4444' },
  { label: 'ux', colour: '#a855f7' },
  { label: 'debt', colour: '#f59e0b' },
]

export const USER_PLAN: readonly {
  login: string
  displayName: string
  role: 'director' | 'architect'
  capacity: number | null
  active: boolean
}[] = [
  { login: 'elena', displayName: 'Elena Vasquez', role: 'architect', capacity: 4, active: true },
  { login: 'marc', displayName: 'Marc Dubois', role: 'director', capacity: 2, active: true },
  { login: 'sofia', displayName: 'Sofia Rossi', role: 'architect', capacity: 3, active: true },
  { login: 'tom', displayName: 'Tom Keller', role: 'architect', capacity: null, active: false },
]

export type ProjectExtras = {
  admin: string | null
  calm: boolean
  links: readonly SubjectLink[]
  events: readonly { type: EventType; inDays: number; title: string; minutes: string | null; onFirstEpic: boolean }[]
  risks: readonly { text: string; level: 'high' | 'medium' | 'low'; owner: string | null; openedDaysAgo: number }[]
  decisions: readonly { text: string; by: string; daysAgo: number }[]
  sentence: string
}

export const PROJECT_EXTRAS: Readonly<Record<string, ProjectExtras>> = {
  forge: {
    admin: 'local',
    calm: false,
    links: [
      { kind: 'repo', url: 'https://github.com/techmefr/forge-ops' },
      { kind: 'doc', url: 'https://github.com/techmefr/forge-ops/blob/main/docs/VisualDirection.md' },
    ],
    events: [
      { type: 'other', inDays: -20, title: 'Architecture workshop', minutes: null, onFirstEpic: false },
      { type: 'demo', inDays: 2, title: 'Sprint demo', minutes: null, onFirstEpic: true },
    ],
    risks: [
      { text: 'Two agents may edit the same zone before the reservation lands', level: 'medium', owner: 'elena', openedDaysAgo: 3 },
    ],
    decisions: [{ text: 'Cards move by drag and drop, buttons stay as the keyboard path', by: 'Elena Vasquez', daysAgo: 6 }],
    sentence: 'Delivery is on track, the client review is the next checkpoint.',
  },
  mailer: {
    admin: 'elena',
    calm: false,
    links: [
      { kind: 'repo', url: 'https://github.com/techmefr/mailer' },
      { kind: 'mockup', url: 'https://example.com/mailer-mockups' },
    ],
    events: [{ type: 'client', inDays: -8, title: 'Client demo', minutes: null, onFirstEpic: true }],
    risks: [
      { text: 'The mail vendor API is still closed', level: 'high', owner: 'sofia', openedDaysAgo: 12 },
      { text: 'Attachment size limits are undecided', level: 'medium', owner: null, openedDaysAgo: 4 },
    ],
    decisions: [],
    sentence: 'The vendor API blocks two subjects, we are escalating with the client.',
  },
  atlas: {
    admin: 'sofia',
    calm: true,
    links: [{ kind: 'graphify', url: 'https://example.com/atlas-graph' }],
    events: [
      {
        type: 'production',
        inDays: -2,
        title: 'Zone view release',
        minutes: 'Released to the internal team, no incident.',
        onFirstEpic: true,
      },
    ],
    risks: [],
    decisions: [{ text: 'Zones are declared per path prefix, never per story', by: 'Sofia Rossi', daysAgo: 9 }],
    sentence: 'Zone view is out, colouring is next.',
  },
  harbor: {
    admin: 'marc',
    calm: true,
    links: [
      { kind: 'repo', url: 'https://github.com/techmefr/harbor' },
      { kind: 'speckit', url: 'https://github.com/techmefr/harbor/tree/main/specs' },
      { kind: 'doc', url: 'https://example.com/harbor-runbook' },
    ],
    events: [
      { type: 'steering', inDays: -21, title: 'Steering committee', minutes: 'Scope cut to the payment flow only.', onFirstEpic: false },
      { type: 'client', inDays: -6, title: 'Client review', minutes: null, onFirstEpic: true },
      { type: 'production', inDays: -1, title: 'Payment go-live', minutes: null, onFirstEpic: true },
      { type: 'demo', inDays: 5, title: 'Recovery demo', minutes: null, onFirstEpic: true },
      { type: 'steering', inDays: 12, title: 'Steering committee', minutes: null, onFirstEpic: false },
    ],
    risks: [
      { text: 'The payment provider sandbox is down twice a week', level: 'high', owner: 'marc', openedDaysAgo: 15 },
      { text: 'Go-live slipped and the client was not told', level: 'high', owner: 'elena', openedDaysAgo: 2 },
      { text: 'No load test has been run on the checkout', level: 'medium', owner: null, openedDaysAgo: 10 },
    ],
    decisions: [{ text: 'Freeze all new scope until the go-live is stable', by: 'Marc Dubois', daysAgo: 1 }],
    sentence: 'Go-live slipped, two subjects are late and one is blocked on the provider.',
  },
  lumen: {
    admin: 'elena',
    calm: true,
    links: [{ kind: 'repo', url: 'https://github.com/techmefr/lumen' }],
    events: [
      { type: 'steering', inDays: -10, title: 'Steering committee', minutes: 'Everything on plan, next review in a month.', onFirstEpic: false },
      { type: 'production', inDays: 18, title: 'Public launch', minutes: null, onFirstEpic: true },
    ],
    risks: [{ text: 'Translations for two locales are not reviewed yet', level: 'low', owner: 'tom', openedDaysAgo: 7 }],
    decisions: [{ text: 'Launch on the planned date', by: 'Elena Vasquez', daysAgo: 10 }],
    sentence: 'Everything is on plan for the public launch.',
  },
  sandbox: {
    admin: null,
    calm: true,
    links: [],
    events: [],
    risks: [],
    decisions: [],
    sentence: 'A blank project: define its steps to start the forge.',
  },
}

export const SPARE_EPICS: readonly SpareEpicPlan[] = [
  {
    project: 'forge',
    title: 'Card discussion',
    intent: 'unblock a story through a conversation instead of a click',
    assignee: null,
  },
  {
    project: 'forge',
    title: 'Passerelle GitLab',
    intent: 'follow the merge requests of work launched from the board',
    assignee: 'local',
    planning: { state: 'doing', priority: 'high', statusNote: 'Webhook received, the merge request list is next.' },
  },
  {
    project: 'mailer',
    title: 'Mail search',
    intent: 'find a mail by its subject, sender or content',
    assignee: null,
    planning: { priority: 'max', requestedBy: 'Support team' },
  },
  {
    project: 'mailer',
    title: 'Signature per account',
    intent: 'let each account carry its own signature',
    assignee: 'sofia',
    planning: { state: 'blocked', statusNote: 'Waiting for the mail vendor to open the API.' },
    lateByDays: 4,
    tags: ['backend'],
  },
  {
    project: 'mailer',
    title: 'Attachments',
    intent: 'attach files to a mail without exceeding the provider limit',
    assignee: 'sofia',
    planning: { priority: 'high' },
    dependsOn: ['Signature per account'],
    tags: ['backend', 'debt'],
  },
  {
    project: 'atlas',
    title: 'Hot zone alert',
    intent: 'warn when two stories touch the same folder at the same time',
    assignee: null,
  },
  {
    project: 'atlas',
    title: 'Colour legend',
    intent: 'explain the zone colours right on the map',
    assignee: 'sofia',
    planning: { state: 'doing', priority: 'low' },
    tags: ['ux', 'frontend'],
  },
  {
    project: 'forge',
    title: 'Statistics export',
    intent: 'export costs and durations per project to a file',
    assignee: 'elena',
    planning: { state: 'done', priority: 'low' },
    tags: ['backend'],
  },
  {
    project: 'forge',
    title: 'Session end notifications',
    intent: 'tell the architect when a session waits for validation',
    assignee: 'marc',
    planning: { priority: 'max', requestedBy: 'Client steering', statusNote: 'Design agreed, waiting for the gateway.' },
    dependsOn: ['Passerelle GitLab'],
    tags: ['ux', 'frontend'],
    links: [{ kind: 'mockup', url: 'https://example.com/notifications-mockup' }],
  },
  {
    project: 'forge',
    title: 'Onboarding guide',
    intent: 'welcome a new architect with a guided tour of the board',
    assignee: 'elena',
    planning: { state: 'doing', priority: 'normal' },
    lateByDays: 6,
    tags: ['ux'],
  },
  {
    project: 'forge',
    title: 'Old prototype',
    intent: 'first mockup, abandoned and kept in the bin',
    assignee: null,
    deleted: true,
  },
  {
    project: 'harbor',
    title: 'Payment provider switch',
    intent: 'move to a more stable provider before the end of the month',
    assignee: 'marc',
    planning: { state: 'doing', priority: 'max', statusNote: 'Sandbox keys received, contract not signed.' },
    lateByDays: 9,
    tags: ['security', 'backend'],
    links: [{ kind: 'doc', url: 'https://example.com/payment-provider-comparison' }],
  },
  {
    project: 'harbor',
    title: 'Refund handling',
    intent: 'refund an order from the back-office',
    assignee: 'elena',
    planning: { state: 'blocked', priority: 'high', statusNote: 'Blocked until the provider exposes the refund API.' },
    lateByDays: 3,
    tags: ['backend'],
    dependsOn: ['Payment provider switch'],
  },
  {
    project: 'harbor',
    title: 'Receipts by mail',
    intent: 'send the customer a receipt after every payment',
    assignee: null,
    planning: { priority: 'normal', requestedBy: 'Finance' },
    tags: ['frontend'],
  },
  {
    project: 'harbor',
    title: 'Invoice archive',
    intent: 'keep invoices available for ten years',
    assignee: 'sofia',
    planning: { state: 'done' },
    tags: ['debt'],
  },
  {
    project: 'lumen',
    title: 'Public site',
    intent: 'present the product with a home page and a blog',
    assignee: 'sofia',
    planning: { state: 'doing', priority: 'high' },
    tags: ['frontend', 'ux'],
  },
  {
    project: 'lumen',
    title: 'Dark theme',
    intent: 'offer a dark theme that follows the system',
    assignee: 'elena',
    planning: { state: 'done' },
    tags: ['ux'],
  },
  {
    project: 'lumen',
    title: 'Help centre',
    intent: 'gather the answers to frequent questions',
    assignee: null,
    planning: { priority: 'low' },
  },
]

export const HARBOR_STEPS: readonly WorkflowColumnDraft[] = [
  { ...agentStep('Architecture', 'acc', true), model: 'claude-opus-5-5', effort: 'max', agentName: 'architecte' },
  {
    label: 'Plan review',
    colour: 'warn',
    provider: 'human',
    model: '',
    effort: '',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: false,
  },
  { ...agentStep('Building', 'info', false), provider: 'codex', model: '', effort: 'medium', command: 'BUILD.md' },
  { ...agentStep('Gating', 'orange', true), model: 'claude-haiku-4-5', effort: 'low' },
  { ...agentStep('Reviewing', 'green', false), model: 'claude-sonnet-5', effort: 'xhigh', agentName: 'elrond' },
  { ...agentStep('Shipping', 'red', false), preprompt: 'Rebase, run the gate again, open the MR as a draft.' },
]

export const LUMEN_STEPS: readonly WorkflowColumnDraft[] = [
  agentStep('Architecture', 'acc', true),
  { ...agentStep('Building', 'info', true), model: 'claude-fable-5-1', effort: 'xhigh' },
  { ...agentStep('Design QA', 'violet', false), model: 'claude-sonnet-5', effort: 'medium', agentName: 'link' },
  agentStep('Gating', 'orange', false),
  agentStep('Reviewing', 'green', false),
  agentStep('Shipping', 'red', false),
]

export const HOTFIX_STEPS: readonly WorkflowColumnDraft[] = [
  agentStep('Build', 'info', true),
  agentStep('Review', 'green', false),
  agentStep('Ship', 'red', false),
]

export const PLAN: readonly ProjectPlan[] = [
  {
    slug: 'forge',
    name: 'Forge',
    colour: '#ff3b00',
    epicTitle: 'Forge board',
    epicIntent: 'donner a un architecte IA un board qui suit ses stories du texte au merge',
    stories: [
      {
        slug: 'kanban',
        title: 'view the story kanban',
        body: "As an architect I want to see my stories grouped by step so I know where to look.",
        twinTitle: 'prove the story kanban',
        state: 'done',
        points: 5,
        proven: 'reviewed',
        criteria: [
          { statement: 'une colonne vide reste affichee avec son libelle', met: true },
          { statement: 'une carte porte la couleur de son projet', met: true },
        ],
      },
      {
        slug: 'scope',
        title: 'reserve a story scope',
        body: "As an architect I want a story to announce the paths it touches so two agents never work in the same place.",
        twinTitle: 'prove the scope reservation',
        state: 'reviewing',
        points: 8,
        proven: 'verified',
        criteria: [
          { statement: 'une reservation refusee nomme la story qui tient le chemin', met: true },
          { statement: 'un chemin libere redevient reservable', met: false },
        ],
      },
      {
        slug: 'pilot',
        title: 'drive the browser step by step',
        body: "As an architect I want to play a journey in slow motion and keep a capture of each step.",
        twinTitle: 'prove the browser pilot',
        state: 'gating',
        points: 13,
        proven: 'tests_written',
        criteria: [
          { statement: 'une etape en echec arrete le parcours', met: false },
          { statement: 'chaque acte laisse une capture consultable', met: true },
        ],
      },
      {
        slug: 'digest',
        title: 'summarise a zone automatically',
        body: "As an architect I want a zone to describe itself when an agent touches one of its files.",
        twinTitle: 'prove the zone summary',
        state: 'shipping',
        points: 3,
        proven: 'verified',
        criteria: [{ statement: 'une zone sans fichier le dit plutot que d inventer', met: true }],
      },
      {
        slug: 'metrics',
        title: 'plug in the machine metrics',
        body: "As an architect I want to read the CPU and memory before launching a group of stories.",
        twinTitle: 'prove the machine metrics',
        state: 'building',
        points: 5,
        proven: 'arch_done',
        criteria: [{ statement: 'without a collector the board says why instead of showing zero', met: false }],
      },
      {
        slug: 'plan',
        title: 'validate the architecture plan',
        body: "As an architect I want to review the proposed plan and send it back with my remarks.",
        twinTitle: 'prove the plan validation',
        state: 'plan_review',
        points: 5,
        proven: 'arch_done',
        criteria: [{ statement: 'a plan sent back keeps the remark', met: false }],
      },
      {
        slug: 'estimate',
        title: 'estimate the cost before launch',
        body: "As an architect I want a cost estimate before sending five stories in parallel.",
        twinTitle: 'prove the cost estimate',
        state: 'architecture',
        points: 8,
        proven: 'spec_done',
        criteria: [{ statement: 'an estimate above the cap warns before launch', met: false }],
      },
      {
        slug: 'flag',
        title: 'ship the story behind a flag',
        body: "As an architect I want to open the feature to a share of users only.",
        twinTitle: 'prove the flagged rollout',
        state: 'flagged',
        points: 3,
        proven: 'reviewed',
        criteria: [{ statement: 'a flag at zero percent keeps the feature invisible', met: true }],
      },
      {
        slug: 'orphan',
        title: 'recover an orphan session',
        body: "As an architect I want a session lost at restart to be abandoned cleanly.",
        twinTitle: 'prove the orphan session recovery',
        state: 'escalated',
        points: 2,
        proven: 'tests_written',
        criteria: [{ statement: 'an orphan session no longer blocks its story', met: false }],
      },
      {
        slug: 'stats',
        title: 'export the session statistics',
        body: "As an architect I want to export time and cost per agent over the period.",
        twinTitle: 'prove the statistics export',
        state: 'backlog',
        points: 3,
        proven: null,
        criteria: [{ statement: 'an empty export stays a valid file', met: false }],
      },
      {
        slug: 'rename',
        title: 'rename a repository zone',
        body: "As an architect I want to fix a zone name without losing its history.",
        twinTitle: 'prove the zone rename',
        state: 'drafting',
        points: null,
        proven: null,
        criteria: [],
      },
    ],
  },
  {
    slug: 'mailer',
    name: 'Mailer',
    colour: '#00b3ff',
    epicTitle: 'Mail CRUD',
    epicIntent: 'let the customer manage mails end to end',
    stories: [
      {
        slug: 'list',
        title: 'view the mail list',
        body: 'As a customer I want to see my most recent mails first.',
        twinTitle: 'prove the mail list',
        state: 'done',
        points: 5,
        proven: 'reviewed',
        criteria: [
          { statement: 'an empty inbox shows a message instead of an empty table', met: true },
          { statement: 'mails arrive from newest to oldest', met: true },
        ],
      },
      {
        slug: 'write',
        title: 'create and edit a mail',
        body: 'As a customer I want to write a mail and pick it up later.',
        twinTitle: 'prove mail creation and editing',
        state: 'building',
        points: 8,
        proven: 'tests_written',
        criteria: [{ statement: 'a draft is still there after a reload', met: false }],
      },
      {
        slug: 'delete',
        title: 'delete a mail',
        body: 'As a customer I want to delete a mail and undo right after.',
        twinTitle: 'prove mail deletion',
        state: 'architecture',
        points: 5,
        proven: 'spec_done',
        criteria: [{ statement: 'an undone deletion puts the mail back', met: false }],
      },
      {
        slug: 'archive',
        title: 'archive a mail',
        body: 'As a customer I want to take a mail out of my inbox without losing it.',
        twinTitle: 'prove mail archiving',
        state: 'backlog',
        points: 3,
        proven: null,
        criteria: [{ statement: 'an archived mail can still be found by search', met: false }],
      },
    ],
  },
  {
    slug: 'atlas',
    name: 'Atlas',
    colour: '#7c3aed',
    epicTitle: 'Repository map',
    epicIntent: 'show the architecture that emerges while the agents work',
    stories: [
      {
        slug: 'zones',
        title: 'show the repository zones',
        body: 'As an architect I want to see the zones and their weight without reading code.',
        twinTitle: 'prove the zone display',
        state: 'gating',
        points: 8,
        proven: 'tests_written',
        criteria: [{ statement: 'a zone without files stays listed', met: false }],
      },
      {
        slug: 'colour',
        title: 'colour a file by story',
        body: 'As an architect I want to know at a glance which story touches which file.',
        twinTitle: 'prove the file colouring',
        state: 'backlog',
        points: 5,
        proven: null,
        criteria: [{ statement: 'a file touched by two stories carries both colours', met: false }],
      },
    ],
  },
  {
    slug: 'harbor',
    name: 'Harbor',
    colour: '#f59e0b',
    epicTitle: 'Checkout and payment',
    epicIntent: 'let a customer pay for an order without leaving the site',
    steps: HARBOR_STEPS,
    stories: [
      {
        slug: 'pay',
        title: 'pay an order by card',
        body: 'As a customer I want to pay by card and see my order confirmed at once.',
        twinTitle: 'prove the card payment',
        state: 'reviewing',
        points: 8,
        proven: 'verified',
        criteria: [
          { statement: 'a declined card keeps the basket intact', met: true },
          { statement: 'the confirmation shows the order reference', met: false },
        ],
      },
      {
        slug: 'refund',
        title: 'refund an order',
        body: 'As a shop owner I want to refund an order from the back-office.',
        twinTitle: 'prove the refund flow',
        state: 'building',
        points: 5,
        proven: 'tests_written',
        criteria: [{ statement: 'a partial refund leaves the rest of the order paid', met: false }],
      },
      {
        slug: 'retry',
        title: 'retry a failed payment',
        body: 'As a customer I want to retry a failed payment without refilling the form.',
        twinTitle: 'prove the payment retry',
        state: 'plan_review',
        points: 3,
        proven: 'spec_done',
        criteria: [{ statement: 'three failed attempts lock the order for ten minutes', met: false }],
      },
      {
        slug: 'webhook',
        title: 'handle the provider webhooks',
        body: 'As an operator I want provider webhooks applied once and only once.',
        twinTitle: 'prove the webhook handling',
        state: 'gating',
        points: 5,
        proven: 'build_done',
        criteria: [{ statement: 'a replayed webhook changes nothing', met: false }],
      },
      {
        slug: 'export',
        title: 'export the month payments',
        body: 'As a finance user I want a monthly CSV of all payments.',
        twinTitle: 'prove the monthly export',
        state: 'backlog',
        points: 3,
        proven: null,
        criteria: [{ statement: 'an empty month still produces a header line', met: false }],
      },
    ],
  },
  {
    slug: 'lumen',
    name: 'Lumen',
    colour: '#10b981',
    epicTitle: 'Public launch',
    epicIntent: 'open the product to the public with a clear site and a blog',
    steps: LUMEN_STEPS,
    stories: [
      {
        slug: 'home',
        title: 'show the home page',
        body: 'As a visitor I want a home page that explains the product in ten seconds.',
        twinTitle: 'prove the home page',
        state: 'done',
        points: 3,
        proven: 'reviewed',
        criteria: [{ statement: 'the call to action is visible without scrolling', met: true }],
      },
      {
        slug: 'blog',
        title: 'list the blog posts',
        body: 'As a visitor I want to browse the latest posts.',
        twinTitle: 'prove the blog list',
        state: 'building',
        points: 5,
        proven: 'tests_written',
        criteria: [{ statement: 'posts appear newest first', met: false }],
        column: 'design_qa',
      },
      {
        slug: 'search',
        title: 'search the site',
        body: 'As a visitor I want to search pages by keyword.',
        twinTitle: 'prove the site search',
        state: 'architecture',
        points: 5,
        proven: 'spec_done',
        criteria: [{ statement: 'an empty result explains how to widen the search', met: false }],
      },
      {
        slug: 'faq',
        title: 'publish the FAQ',
        body: 'As a visitor I want answers to the common questions.',
        twinTitle: 'prove the FAQ page',
        state: 'backlog',
        points: 2,
        proven: null,
        criteria: [{ statement: 'each question links to its own anchor', met: false }],
      },
    ],
  },
  {
    slug: 'sandbox',
    name: 'Sandbox',
    colour: '#64748b',
    epicTitle: 'First steps',
    epicIntent: 'an empty project to try defining your own steps',
    steps: [],
    stories: [],
  },
]

export const ZONE_PLAN: readonly { project: string; pathPrefix: string; name: string; colour: string }[] = [
  { project: 'forge', pathPrefix: 'backend/src/domain/Story', name: 'Story', colour: '#ff3b00' },
  { project: 'forge', pathPrefix: 'backend/src/domain/Pilot', name: 'Pilot', colour: '#00b3ff' },
  { project: 'forge', pathPrefix: 'backend/src/domain/Zone', name: 'Zone', colour: '#22c55e' },
  { project: 'forge', pathPrefix: 'frontend/src/domain/Board', name: 'Board', colour: '#7c3aed' },
  { project: 'mailer', pathPrefix: 'src/domain/Mail', name: 'Mail', colour: '#00b3ff' },
  { project: 'atlas', pathPrefix: 'src/domain/Atlas', name: 'Atlas', colour: '#7c3aed' },
]

export const TOUCH_PLAN: readonly { story: string; paths: readonly string[] }[] = [
  {
    story: 'forge/kanban',
    paths: [
      'backend/src/domain/Story/StoryRepository.ts',
      'backend/tests/domain/Story/StoryRepository.test.ts',
      'frontend/src/domain/Board/KanbanScreen.vue',
    ],
  },
  {
    story: 'forge/scope',
    paths: ['backend/src/domain/Story/Story.ts', 'frontend/src/domain/Board/BoardModel.ts'],
  },
  {
    story: 'forge/pilot',
    paths: [
      'backend/src/domain/Pilot/PilotRepository.ts',
      'backend/src/domain/Pilot/Parcours.ts',
      'backend/tests/domain/Pilot/Parcours.test.ts',
    ],
  },
  {
    story: 'forge/digest',
    paths: ['backend/src/domain/Zone/ZoneDigest.ts', 'db/forge.sql'],
  },
  {
    story: 'mailer/list',
    paths: ['src/domain/Mail/MailRepository.ts', 'src/domain/Mail/MailScreen.vue'],
  },
  {
    story: 'mailer/write',
    paths: ['src/domain/Mail/MailDraft.ts'],
  },
  {
    story: 'atlas/zones',
    paths: ['src/domain/Atlas/AtlasScreen.vue'],
  },
]

export type SessionPlan = {
  story: string
  phase: AgentPhase
  agentName: string
  daysAgo: number
  seconds: number
  costUsd: number
  inputTokens: number
  outputTokens: number
  exit: SessionExit | null
}

export const SESSION_PLAN: readonly SessionPlan[] = [
  { story: 'forge/kanban', phase: 'spec', agentName: 'scribe', daysAgo: 6, seconds: 420, costUsd: 0.18, inputTokens: 24000, outputTokens: 3100, exit: { exitCode: 0 } },
  { story: 'forge/kanban', phase: 'architecture', agentName: 'architecte', daysAgo: 6, seconds: 610, costUsd: 0.31, inputTokens: 41000, outputTokens: 5200, exit: { exitCode: 0 } },
  { story: 'forge/kanban', phase: 'tdd', agentName: 'dozer', daysAgo: 5, seconds: 980, costUsd: 0.52, inputTokens: 68000, outputTokens: 9400, exit: { exitCode: 0 } },
  { story: 'forge/kanban', phase: 'code', agentName: 'neo', daysAgo: 5, seconds: 2410, costUsd: 1.44, inputTokens: 180000, outputTokens: 22000, exit: { exitCode: 0 } },
  { story: 'forge/kanban', phase: 'review', agentName: 'elrond', daysAgo: 4, seconds: 520, costUsd: 0.27, inputTokens: 39000, outputTokens: 4100, exit: { exitCode: 0 } },
  { story: 'forge/scope', phase: 'code', agentName: 'trinity', daysAgo: 3, seconds: 3120, costUsd: 1.98, inputTokens: 240000, outputTokens: 31000, exit: { exitCode: 1 } },
  { story: 'forge/scope', phase: 'code', agentName: 'trinity', daysAgo: 3, seconds: 2650, costUsd: 1.61, inputTokens: 205000, outputTokens: 26000, exit: { exitCode: 0 } },
  { story: 'forge/scope', phase: 'review', agentName: 'elrond', daysAgo: 2, seconds: 640, costUsd: 0.34, inputTokens: 47000, outputTokens: 5300, exit: { exitCode: 0 } },
  { story: 'forge/pilot', phase: 'tdd', agentName: 'dozer', daysAgo: 2, seconds: 1450, costUsd: 0.81, inputTokens: 96000, outputTokens: 14000, exit: { exitCode: 0 } },
  { story: 'forge/pilot', phase: 'code', agentName: 'neo', daysAgo: 1, seconds: 4200, costUsd: 2.63, inputTokens: 310000, outputTokens: 44000, exit: { timedOut: true, exitCode: null } },
  { story: 'forge/digest', phase: 'code', agentName: 'trinity', daysAgo: 1, seconds: 1180, costUsd: 0.66, inputTokens: 82000, outputTokens: 11000, exit: { exitCode: 0 } },
  { story: 'forge/metrics', phase: 'code', agentName: 'trinity', daysAgo: 1, seconds: 760, costUsd: 0.41, inputTokens: 52000, outputTokens: 6800, exit: null },
  { story: 'forge/orphan', phase: 'code', agentName: 'neo', daysAgo: 1, seconds: 300, costUsd: 0.19, inputTokens: 21000, outputTokens: 2600, exit: { exitCode: null, reason: 'loop' } },
  { story: 'forge/estimate', phase: 'spec', agentName: 'scribe', daysAgo: 0, seconds: 380, costUsd: 0.16, inputTokens: 22000, outputTokens: 2900, exit: { exitCode: 0 } },
  { story: 'mailer/list', phase: 'code', agentName: 'morpheus', daysAgo: 4, seconds: 2960, costUsd: 1.72, inputTokens: 218000, outputTokens: 28000, exit: { exitCode: 0 } },
  { story: 'mailer/list', phase: 'review', agentName: 'seraph', daysAgo: 3, seconds: 480, costUsd: 0.25, inputTokens: 36000, outputTokens: 3800, exit: { exitCode: 0 } },
  { story: 'mailer/write', phase: 'code', agentName: 'morpheus', daysAgo: 0, seconds: 1520, costUsd: 0.89, inputTokens: 104000, outputTokens: 15000, exit: null },
  { story: 'mailer/delete', phase: 'architecture', agentName: 'architecte', daysAgo: 0, seconds: 540, costUsd: 0.28, inputTokens: 38000, outputTokens: 4600, exit: { exitCode: 0 } },
  { story: 'atlas/zones', phase: 'tdd', agentName: 'dozer', daysAgo: 2, seconds: 1120, costUsd: 0.61, inputTokens: 76000, outputTokens: 10000, exit: { exitCode: 0 } },
  { story: 'atlas/zones', phase: 'gate', agentName: 'galadriel', daysAgo: 1, seconds: 410, costUsd: 0.22, inputTokens: 31000, outputTokens: 3300, exit: { exitCode: 2 } },
  { story: 'harbor/pay', phase: 'code', agentName: 'trinity', daysAgo: 3, seconds: 2800, costUsd: 1.75, inputTokens: 220000, outputTokens: 29000, exit: { exitCode: 0 } },
  { story: 'harbor/pay', phase: 'review', agentName: 'elrond', daysAgo: 0, seconds: 560, costUsd: 0.33, inputTokens: 45000, outputTokens: 5200, exit: { exitCode: 0 } },
  { story: 'harbor/refund', phase: 'code', agentName: 'trinity', daysAgo: 0, seconds: 900, costUsd: 0.52, inputTokens: 70000, outputTokens: 9000, exit: null },
  { story: 'harbor/retry', phase: 'architecture', agentName: 'architecte', daysAgo: 1, seconds: 640, costUsd: 0.41, inputTokens: 52000, outputTokens: 6100, exit: { exitCode: 0 } },
  { story: 'harbor/webhook', phase: 'code', agentName: 'trinity', daysAgo: 2, seconds: 1900, costUsd: 1.12, inputTokens: 150000, outputTokens: 19000, exit: { exitCode: 0 } },
  { story: 'harbor/webhook', phase: 'gate', agentName: 'galadriel', daysAgo: 1, seconds: 380, costUsd: 0.2, inputTokens: 29000, outputTokens: 3100, exit: { exitCode: 2 } },
  { story: 'lumen/home', phase: 'code', agentName: 'neo', daysAgo: 6, seconds: 1500, costUsd: 0.9, inputTokens: 110000, outputTokens: 14000, exit: { exitCode: 0 } },
  { story: 'lumen/blog', phase: 'code', agentName: 'neo', daysAgo: 0, seconds: 700, costUsd: 0.44, inputTokens: 58000, outputTokens: 7200, exit: null },
  { story: 'lumen/search', phase: 'architecture', agentName: 'architecte', daysAgo: 0, seconds: 480, costUsd: 0.3, inputTokens: 40000, outputTokens: 4800, exit: { exitCode: 0 } },
]

export type RemarkPlan = {
  story: string
  author: string
  voice: 'human' | 'agent'
  body: string
}

export const REMARK_PLAN: readonly RemarkPlan[] = [
  {
    story: 'forge/rename',
    author: 'local',
    voice: 'human',
    body: 'A badly named zone stays badly named because renaming it would lose its history. I want to fix the name without losing anything.',
  },
  {
    story: 'forge/rename',
    author: 'architecte',
    voice: 'agent',
    body: 'The path prefix is the key of the zone, the name is only a label. Renaming touches neither the attached files nor the summaries already written.',
  },
  {
    story: 'forge/rename',
    author: 'local',
    voice: 'human',
    body: 'What if two zones of the same project end up with the same name?',
  },
  {
    story: 'forge/rename',
    author: 'architecte',
    voice: 'agent',
    body: 'The board refuses the rename and names the zone that already holds that name, as it already refuses two reservations on the same path.',
  },
  {
    story: 'forge/scope',
    author: 'local',
    voice: 'human',
    body: 'The security remark about the absolute path is right, but it will wait for the next story: this one does not touch the comparison.',
  },
  {
    story: 'harbor/retry',
    author: 'architecte',
    voice: 'agent',
    body: 'Plan ready for your review: the retry reuses the stored payment intent, so the card form is never refilled. Three failed attempts lock the order for ten minutes.',
  },
  {
    story: 'harbor/retry',
    author: 'local',
    voice: 'human',
    body: 'Does the lock also apply to a customer who changes card between attempts?',
  },
  {
    story: 'harbor/retry',
    author: 'architecte',
    voice: 'agent',
    body: 'Yes, the counter belongs to the order, not to the card. I can move it to the customer if you prefer.',
  },
  {
    story: 'harbor/pay',
    author: 'elrond',
    voice: 'agent',
    body: 'Review pass done: one weak finding on the confirmation screen, the order reference is not announced to screen readers.',
  },
  {
    story: 'harbor/webhook',
    author: 'galadriel',
    voice: 'agent',
    body: 'The gate failed: the replay test writes twice when two webhooks arrive within the same second. The dedupe key needs the provider event id.',
  },
  {
    story: 'lumen/search',
    author: 'architecte',
    voice: 'agent',
    body: 'Spec and plan drafted. I need one answer before building: should the search cover the blog posts or only the static pages?',
  },
  {
    story: 'lumen/search',
    author: 'local',
    voice: 'human',
    body: 'Both, but static pages rank first.',
  },
  {
    story: 'forge/metrics',
    author: 'trinity',
    voice: 'agent',
    body: 'Without a collector plugged in I cannot fill the memory, so I leave the field empty and say so instead of writing zero.',
  },
]

