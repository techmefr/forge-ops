import type { EpicPatch, SubjectLink } from '../../../contract/EpicContract.js'
import type { EventType } from '../../../contract/EventContract.js'
import type { Milestone, MilestoneKind } from '../../../contract/StoryContract.js'
import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../domain/Checkpoint/CheckpointRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../domain/Checkpoint/PermissiveCheckpointGate.js'
import { createCriterionRepository } from '../domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createZoneRepository } from '../domain/Zone/ZoneRepository.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createDiscussionRepository } from '../domain/Discussion/DiscussionRepository.js'
import { createBudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { describeZone } from '../domain/Zone/ZoneDigest.js'
import { REVIEW_LENS_SEQUENCE } from '../domain/Checkpoint/Checkpoint.js'
import type { CheckpointName } from '../domain/Checkpoint/Checkpoint.js'
import type { StoryState } from '../domain/Story/Story.js'
import type { AgentPhase } from '../domain/Agent/AgentSession.js'
import { createWorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import type { WorkflowColumnDraft } from '../../../contract/WorkflowColumnContract.js'
import type { SessionExit } from '../domain/Agent/SessionOutcome.js'

function agentStep(label: string, colour: string, autoStart: boolean): WorkflowColumnDraft {
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

const DEMO_STEPS: readonly WorkflowColumnDraft[] = [
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

const MILESTONE_SPREAD: readonly { kind: MilestoneKind; inDays: number }[] = [
  { kind: 'demo', inDays: 4 },
  { kind: 'production', inDays: 21 },
  { kind: 'everyone', inDays: 45 },
]

function milestonesOf(epicId: number, rank: number): readonly Milestone[] {
  const start = Date.now()
  return MILESTONE_SPREAD.map(({ kind, inDays }) => ({
    epicId,
    kind,
    dueOn: new Date(start + (inDays - rank * 6) * 86400000).toISOString().slice(0, 10),
  }))
}

function dayFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

export type DemoBoard = {
  projects: number
  stories: number
  sessions: number
  zones: number
}

const MARKER = 'demo_seed'
const CENSUS = { tests: 24, skipped: 1, tautologies: 0 }
const LENS_AGENTS = { quality: 'elrond', security: 'seraph', accessibility: 'link' } as const
const LENS_SECONDS = { quality: 540, security: 420, accessibility: 360 } as const
const LENS_COST = { quality: 0.29, security: 0.24, accessibility: 0.19 } as const
const LENS_TOKENS = { quality: 42000, security: 35000, accessibility: 28000 } as const

type StoryPlan = {
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

type ProjectPlan = {
  slug: string
  name: string
  colour: string
  epicTitle: string
  epicIntent: string
  stories: readonly StoryPlan[]
  steps?: readonly WorkflowColumnDraft[]
}

const PROVEN_UP_TO: readonly CheckpointName[] = [
  'spec_done',
  'arch_done',
  'tests_written',
  'build_done',
  'verified',
  'reviewed',
]


type SpareEpicPlan = {
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

const TAG_PLAN: readonly { label: string; colour: string }[] = [
  { label: 'frontend', colour: '#5b8def' },
  { label: 'backend', colour: '#22c55e' },
  { label: 'security', colour: '#ef4444' },
  { label: 'ux', colour: '#a855f7' },
  { label: 'debt', colour: '#f59e0b' },
]

const USER_PLAN: readonly {
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

type ProjectExtras = {
  admin: string | null
  calm: boolean
  links: readonly SubjectLink[]
  events: readonly { type: EventType; inDays: number; title: string; minutes: string | null; onFirstEpic: boolean }[]
  risks: readonly { text: string; level: 'high' | 'medium' | 'low'; owner: string | null; openedDaysAgo: number }[]
  decisions: readonly { text: string; by: string; daysAgo: number }[]
  sentence: string
}

const PROJECT_EXTRAS: Readonly<Record<string, ProjectExtras>> = {
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

const SPARE_EPICS: readonly SpareEpicPlan[] = [
  {
    project: 'forge',
    title: 'Discussion sur une carte',
    intent: 'permettre de debloquer une story par un echange plutot que par un clic',
    assignee: null,
  },
  {
    project: 'forge',
    title: 'Passerelle GitLab',
    intent: 'suivre les merge requests du travail lance depuis le board',
    assignee: 'local',
    planning: { state: 'doing', priority: 'high', statusNote: 'Webhook received, the merge request list is next.' },
  },
  {
    project: 'mailer',
    title: 'Recherche dans les mails',
    intent: 'retrouver un mail par son sujet, son expediteur ou son contenu',
    assignee: null,
    planning: { priority: 'max', requestedBy: 'Support team' },
  },
  {
    project: 'mailer',
    title: 'Signature par compte',
    intent: 'laisser chaque compte porter sa propre signature',
    assignee: 'sofia',
    planning: { state: 'blocked', statusNote: 'Waiting for the mail vendor to open the API.' },
    lateByDays: 4,
    tags: ['backend'],
  },
  {
    project: 'mailer',
    title: 'Pieces jointes',
    intent: 'joindre des fichiers a un mail sans depasser la limite du fournisseur',
    assignee: 'sofia',
    planning: { priority: 'high' },
    dependsOn: ['Signature par compte'],
    tags: ['backend', 'debt'],
  },
  {
    project: 'atlas',
    title: 'Alerte de zone chaude',
    intent: 'prevenir quand deux stories touchent le meme dossier en meme temps',
    assignee: null,
  },
  {
    project: 'atlas',
    title: 'Legende des couleurs',
    intent: 'expliquer les couleurs de zones directement sur la carte',
    assignee: 'sofia',
    planning: { state: 'doing', priority: 'low' },
    tags: ['ux', 'frontend'],
  },
  {
    project: 'forge',
    title: 'Export des statistiques',
    intent: 'sortir les couts et les durees par projet en un fichier',
    assignee: 'elena',
    planning: { state: 'done', priority: 'low' },
    tags: ['backend'],
  },
  {
    project: 'forge',
    title: 'Notifications de fin de session',
    intent: 'prevenir l architecte quand une session attend sa validation',
    assignee: 'marc',
    planning: { priority: 'max', requestedBy: 'Client steering', statusNote: 'Design agreed, waiting for the gateway.' },
    dependsOn: ['Passerelle GitLab'],
    tags: ['ux', 'frontend'],
    links: [{ kind: 'mockup', url: 'https://example.com/notifications-mockup' }],
  },
  {
    project: 'forge',
    title: 'Guide d onboarding',
    intent: 'accueillir un nouvel architecte avec une visite guidee du board',
    assignee: 'elena',
    planning: { state: 'doing', priority: 'normal' },
    lateByDays: 6,
    tags: ['ux'],
  },
  {
    project: 'forge',
    title: 'Ancien prototype',
    intent: 'premiere maquette abandonnee, gardee dans la corbeille',
    assignee: null,
    deleted: true,
  },
  {
    project: 'harbor',
    title: 'Changement de fournisseur de paiement',
    intent: 'basculer vers un fournisseur plus stable avant la fin du mois',
    assignee: 'marc',
    planning: { state: 'doing', priority: 'max', statusNote: 'Sandbox keys received, contract not signed.' },
    lateByDays: 9,
    tags: ['security', 'backend'],
    links: [{ kind: 'doc', url: 'https://example.com/payment-provider-comparison' }],
  },
  {
    project: 'harbor',
    title: 'Gestion des remboursements',
    intent: 'rembourser une commande depuis le back-office',
    assignee: 'elena',
    planning: { state: 'blocked', priority: 'high', statusNote: 'Blocked until the provider exposes the refund API.' },
    lateByDays: 3,
    tags: ['backend'],
    dependsOn: ['Changement de fournisseur de paiement'],
  },
  {
    project: 'harbor',
    title: 'Recus par mail',
    intent: 'envoyer un recu au client apres chaque paiement',
    assignee: null,
    planning: { priority: 'normal', requestedBy: 'Finance' },
    tags: ['frontend'],
  },
  {
    project: 'harbor',
    title: 'Archive des factures',
    intent: 'garder les factures consultables pendant dix ans',
    assignee: 'sofia',
    planning: { state: 'done' },
    tags: ['debt'],
  },
  {
    project: 'lumen',
    title: 'Site public',
    intent: 'presenter le produit avec une page d accueil et un blog',
    assignee: 'sofia',
    planning: { state: 'doing', priority: 'high' },
    tags: ['frontend', 'ux'],
  },
  {
    project: 'lumen',
    title: 'Theme sombre',
    intent: 'proposer un theme sombre suivant le systeme',
    assignee: 'elena',
    planning: { state: 'done' },
    tags: ['ux'],
  },
  {
    project: 'lumen',
    title: 'Centre d aide',
    intent: 'rassembler les reponses aux questions frequentes',
    assignee: null,
    planning: { priority: 'low' },
  },
]

const HARBOR_STEPS: readonly WorkflowColumnDraft[] = [
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

const LUMEN_STEPS: readonly WorkflowColumnDraft[] = [
  agentStep('Architecture', 'acc', true),
  { ...agentStep('Building', 'info', true), model: 'claude-fable-5-1', effort: 'xhigh' },
  { ...agentStep('Design QA', 'violet', false), model: 'claude-sonnet-5', effort: 'medium', agentName: 'link' },
  agentStep('Gating', 'orange', false),
  agentStep('Reviewing', 'green', false),
  agentStep('Shipping', 'red', false),
]

const PLAN: readonly ProjectPlan[] = [
  {
    slug: 'forge',
    name: 'Forge',
    colour: '#ff3b00',
    epicTitle: 'Board de la forge',
    epicIntent: 'donner a un architecte IA un board qui suit ses stories du texte au merge',
    stories: [
      {
        slug: 'kanban',
        title: 'visualiser le kanban des stories',
        body: "En tant qu architecte je veux voir mes stories rangees par etape pour savoir ou porter mon attention.",
        twinTitle: 'prouver le kanban des stories',
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
        title: 'reserver le perimetre d une story',
        body: "En tant qu architecte je veux qu une story annonce les chemins qu elle touche pour eviter deux agents au meme endroit.",
        twinTitle: 'prouver la reservation de perimetre',
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
        title: 'piloter le navigateur pas a pas',
        body: "En tant qu architecte je veux derouler un parcours au ralenti et garder une capture par etape.",
        twinTitle: 'prouver le pilotage du navigateur',
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
        title: 'resumer une zone automatiquement',
        body: "En tant qu architecte je veux qu une zone se decrive toute seule quand un agent y touche un fichier.",
        twinTitle: 'prouver le resume de zone',
        state: 'shipping',
        points: 3,
        proven: 'verified',
        criteria: [{ statement: 'une zone sans fichier le dit plutot que d inventer', met: true }],
      },
      {
        slug: 'metrics',
        title: 'brancher les metriques machine',
        body: "En tant qu architecte je veux lire le cpu et la memoire avant de lancer un groupe de stories.",
        twinTitle: 'prouver les metriques machine',
        state: 'building',
        points: 5,
        proven: 'arch_done',
        criteria: [{ statement: 'sans collecteur le board dit pourquoi au lieu d afficher zero', met: false }],
      },
      {
        slug: 'plan',
        title: 'valider le plan d architecture',
        body: "En tant qu architecte je veux relire le plan propose et le renvoyer avec mes remarques.",
        twinTitle: 'prouver la validation du plan',
        state: 'plan_review',
        points: 5,
        proven: 'arch_done',
        criteria: [{ statement: 'un plan renvoye garde la trace de la remarque', met: false }],
      },
      {
        slug: 'estimate',
        title: 'estimer le cout avant lancement',
        body: "En tant qu architecte je veux une estimation de cout avant d envoyer cinq stories en parallele.",
        twinTitle: 'prouver l estimation de cout',
        state: 'architecture',
        points: 8,
        proven: 'spec_done',
        criteria: [{ statement: 'une estimation au dela du plafond alerte avant de lancer', met: false }],
      },
      {
        slug: 'flag',
        title: 'sortir la story derriere un flag',
        body: "En tant qu architecte je veux ouvrir la fonctionnalite a une part des utilisateurs seulement.",
        twinTitle: 'prouver la sortie derriere un flag',
        state: 'flagged',
        points: 3,
        proven: 'reviewed',
        criteria: [{ statement: 'un flag a zero pour cent laisse la fonctionnalite invisible', met: true }],
      },
      {
        slug: 'orphan',
        title: 'rattraper une session orpheline',
        body: "En tant qu architecte je veux qu une session perdue au redemarrage soit abandonnee proprement.",
        twinTitle: 'prouver le rattrapage des sessions orphelines',
        state: 'escalated',
        points: 2,
        proven: 'tests_written',
        criteria: [{ statement: 'une session orpheline ne bloque plus sa story', met: false }],
      },
      {
        slug: 'stats',
        title: 'exporter les statistiques de sessions',
        body: "En tant qu architecte je veux sortir le temps et le cout par agent sur la periode.",
        twinTitle: 'prouver l export des statistiques',
        state: 'backlog',
        points: 3,
        proven: null,
        criteria: [{ statement: 'un export vide reste un fichier valide', met: false }],
      },
      {
        slug: 'rename',
        title: 'renommer une zone du depot',
        body: "En tant qu architecte je veux corriger le nom d une zone sans perdre son historique.",
        twinTitle: 'prouver le renommage d une zone',
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
    epicTitle: 'CRUD Mail',
    epicIntent: 'permettre au client de gerer ses mails de bout en bout',
    stories: [
      {
        slug: 'list',
        title: 'visualiser la liste des mails',
        body: 'En tant que client je veux voir mes mails les plus recents en premier.',
        twinTitle: 'prouver la liste des mails',
        state: 'done',
        points: 5,
        proven: 'reviewed',
        criteria: [
          { statement: 'une boite vide affiche un message plutot qu un tableau vide', met: true },
          { statement: 'les mails arrivent du plus recent au plus ancien', met: true },
        ],
      },
      {
        slug: 'write',
        title: 'creer et modifier un mail',
        body: 'En tant que client je veux rediger un mail et le reprendre plus tard.',
        twinTitle: 'prouver la creation et la modification d un mail',
        state: 'building',
        points: 8,
        proven: 'tests_written',
        criteria: [{ statement: 'un brouillon se retrouve apres rechargement', met: false }],
      },
      {
        slug: 'delete',
        title: 'supprimer un mail',
        body: 'En tant que client je veux supprimer un mail et pouvoir annuler juste apres.',
        twinTitle: 'prouver la suppression d un mail',
        state: 'architecture',
        points: 5,
        proven: 'spec_done',
        criteria: [{ statement: 'une suppression annulee remet le mail a sa place', met: false }],
      },
      {
        slug: 'archive',
        title: 'archiver un mail',
        body: 'En tant que client je veux sortir un mail de ma boite sans le perdre.',
        twinTitle: 'prouver l archivage d un mail',
        state: 'backlog',
        points: 3,
        proven: null,
        criteria: [{ statement: 'un mail archive reste retrouvable par la recherche', met: false }],
      },
    ],
  },
  {
    slug: 'atlas',
    name: 'Atlas',
    colour: '#7c3aed',
    epicTitle: 'Cartographie du depot',
    epicIntent: 'montrer l architecture qui emerge pendant que les agents travaillent',
    stories: [
      {
        slug: 'zones',
        title: 'afficher les zones du depot',
        body: 'En tant qu architecte je veux voir les zones et leur poids sans lire le code.',
        twinTitle: 'prouver l affichage des zones',
        state: 'gating',
        points: 8,
        proven: 'tests_written',
        criteria: [{ statement: 'une zone sans fichier reste listee', met: false }],
      },
      {
        slug: 'colour',
        title: 'colorer un fichier par story',
        body: 'En tant qu architecte je veux savoir quelle story touche quel fichier au premier regard.',
        twinTitle: 'prouver la coloration des fichiers',
        state: 'backlog',
        points: 5,
        proven: null,
        criteria: [{ statement: 'un fichier touche par deux stories porte les deux couleurs', met: false }],
      },
    ],
  },
  {
    slug: 'harbor',
    name: 'Harbor',
    colour: '#f59e0b',
    epicTitle: 'Checkout et paiement',
    epicIntent: 'permettre a un client de payer sa commande sans quitter le site',
    steps: HARBOR_STEPS,
    stories: [
      {
        slug: 'pay',
        title: 'payer une commande par carte',
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
        title: 'rembourser une commande',
        body: 'As a shop owner I want to refund an order from the back-office.',
        twinTitle: 'prove the refund flow',
        state: 'building',
        points: 5,
        proven: 'tests_written',
        criteria: [{ statement: 'a partial refund leaves the rest of the order paid', met: false }],
      },
      {
        slug: 'retry',
        title: 'relancer un paiement echoue',
        body: 'As a customer I want to retry a failed payment without refilling the form.',
        twinTitle: 'prove the payment retry',
        state: 'plan_review',
        points: 3,
        proven: 'spec_done',
        criteria: [{ statement: 'three failed attempts lock the order for ten minutes', met: false }],
      },
      {
        slug: 'webhook',
        title: 'traiter les webhooks du fournisseur',
        body: 'As an operator I want provider webhooks applied once and only once.',
        twinTitle: 'prove the webhook handling',
        state: 'gating',
        points: 5,
        proven: 'build_done',
        criteria: [{ statement: 'a replayed webhook changes nothing', met: false }],
      },
      {
        slug: 'export',
        title: 'exporter les paiements du mois',
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
    epicTitle: 'Lancement public',
    epicIntent: 'ouvrir le produit au public avec un site clair et un blog',
    steps: LUMEN_STEPS,
    stories: [
      {
        slug: 'home',
        title: 'afficher la page d accueil',
        body: 'As a visitor I want a home page that explains the product in ten seconds.',
        twinTitle: 'prove the home page',
        state: 'done',
        points: 3,
        proven: 'reviewed',
        criteria: [{ statement: 'the call to action is visible without scrolling', met: true }],
      },
      {
        slug: 'blog',
        title: 'lister les articles du blog',
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
        title: 'rechercher dans le site',
        body: 'As a visitor I want to search pages by keyword.',
        twinTitle: 'prove the site search',
        state: 'architecture',
        points: 5,
        proven: 'spec_done',
        criteria: [{ statement: 'an empty result explains how to widen the search', met: false }],
      },
      {
        slug: 'faq',
        title: 'publier la foire aux questions',
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
    epicTitle: 'Premiers pas',
    epicIntent: 'un projet vide pour essayer de definir ses propres etapes',
    steps: [],
    stories: [],
  },
]

const ZONE_PLAN: readonly { project: string; pathPrefix: string; name: string; colour: string }[] = [
  { project: 'forge', pathPrefix: 'backend/src/domain/Story', name: 'Story', colour: '#ff3b00' },
  { project: 'forge', pathPrefix: 'backend/src/domain/Pilot', name: 'Pilot', colour: '#00b3ff' },
  { project: 'forge', pathPrefix: 'backend/src/domain/Zone', name: 'Zone', colour: '#22c55e' },
  { project: 'forge', pathPrefix: 'frontend/src/domain/Board', name: 'Board', colour: '#7c3aed' },
  { project: 'mailer', pathPrefix: 'src/domain/Mail', name: 'Mail', colour: '#00b3ff' },
  { project: 'atlas', pathPrefix: 'src/domain/Atlas', name: 'Atlas', colour: '#7c3aed' },
]

const TOUCH_PLAN: readonly { story: string; paths: readonly string[] }[] = [
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

type SessionPlan = {
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

const SESSION_PLAN: readonly SessionPlan[] = [
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

type RemarkPlan = {
  story: string
  author: string
  voice: 'human' | 'agent'
  body: string
}

const REMARK_PLAN: readonly RemarkPlan[] = [
  {
    story: 'forge/rename',
    author: 'local',
    voice: 'human',
    body: 'Une zone mal nommee reste mal nommee parce que la renommer perdrait son historique. Je veux pouvoir corriger le nom sans rien perdre.',
  },
  {
    story: 'forge/rename',
    author: 'architecte',
    voice: 'agent',
    body: 'Le prefixe de chemin est la cle de la zone, le nom n est qu un libelle. Renommer ne touche donc ni les fichiers rattaches ni les resumes deja ecrits.',
  },
  {
    story: 'forge/rename',
    author: 'local',
    voice: 'human',
    body: 'Et si deux zones du meme projet finissent avec le meme nom ?',
  },
  {
    story: 'forge/rename',
    author: 'architecte',
    voice: 'agent',
    body: 'Le board refuse le renommage et nomme la zone qui tient deja ce nom, comme il refuse deja deux reservations sur le meme chemin.',
  },
  {
    story: 'forge/scope',
    author: 'local',
    voice: 'human',
    body: 'La remarque de securite sur le chemin absolu est juste, mais elle attendra la story suivante : celle-ci ne touche pas la comparaison.',
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
    body: 'Sans collecteur branche je ne peux pas remplir la memoire, je laisse le champ vide et je le dis plutot que d ecrire zero.',
  },
]

export function reviveDemoSessions(db: Database.Database): number {
  const revive = db.prepare<[string]>(
    `UPDATE agent_session
        SET lifecycle = 'working', outcome = NULL, ended_at = NULL, last_heartbeat_at = datetime('now')
      WHERE claude_session_id = ?`,
  )
  let revived = 0
  SESSION_PLAN.forEach((plan, index) => {
    if (plan.exit === null) {
      revived += revive.run(`${plan.story.replace('/', '-')}-${plan.phase}-${index}`).changes
    }
  })
  return revived
}

function evidenceOf(reference: string, name: CheckpointName): string {
  return `.claude/evidence/${reference.toLowerCase()}/${name}.md`
}

export function seedDemoBoard(db: Database.Database): DemoBoard {
  const marker = db
    .prepare<[string], { value: string }>('SELECT value FROM board_setting WHERE key = ?')
    .get(MARKER)
  const stories = createStoryRepository(db)
  const zones = createZoneRepository(db)
  if (marker !== undefined) {
    return {
      projects: stories.listProjects().length,
      stories: stories.listKanban().length,
      sessions: SESSION_PLAN.length,
      zones: ZONE_PLAN.length,
    }
  }

  const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => CENSUS,
  })
  const criteria = createCriterionRepository(db)
  const sessions = createAgentSessionRepository(db)
  const foremerge = createForemergeRepository(db, { stories })
  const budget = createBudgetRepository(db)
  const discussion = createDiscussionRepository(db, { stories })
  const identities = createIdentityRepository(db)

  identities.bootstrapSuperAdmin({ login: 'local', password: randomBytes(24).toString('hex') })
  identities.changeCapacity('local', 5)
  identities.changeDisplayName('local', 'Demo architect')
  for (const user of USER_PLAN) {
    identities.enrolUser({
      login: user.login,
      displayName: user.displayName,
      password: randomBytes(24).toString('hex'),
      role: user.role,
    })
    if (user.capacity !== null) {
      identities.changeCapacity(user.login, user.capacity)
    }
    if (!user.active) {
      identities.changeActive(user.login, false)
    }
  }
  const tagIds = new Map<string, number>()
  for (const tag of TAG_PLAN) {
    tagIds.set(tag.label, stories.epics.createTag(tag).id)
  }

  const setState = db.prepare<[StoryState, StoryState, number]>(
    `UPDATE story
        SET state = ?,
            workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                JOIN epic ON epic.project_id = workflow_column.project_id
               WHERE epic.id = story.epic_id AND workflow_column.key = ?
            )
      WHERE id = ?`,
  )
  const workflowColumns = createWorkflowColumnRepository(db)
  const placeInColumn = db.prepare<[string, number]>(
    `UPDATE story
        SET workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                JOIN epic ON epic.project_id = workflow_column.project_id
               WHERE epic.id = story.epic_id AND workflow_column.key = ?
            )
      WHERE id = ?`,
  )
  const setEscalation = db.prepare<[string, number]>('UPDATE story SET escalation_reason = ? WHERE id = ?')
  const backdateSession = db.prepare<[number, number, number, string]>(
    `UPDATE agent_session
        SET started_at = datetime('now', ?  || ' days', ? || ' seconds'),
            ended_at = CASE WHEN ended_at IS NULL THEN NULL ELSE datetime('now', ? || ' days') END
      WHERE claude_session_id = ?`,
  )
  const insertWorktree = db.prepare<[number, string, string, string, string]>(
    'INSERT INTO worktree (story_id, path, branch, base_ref, base_sha) VALUES (?, ?, ?, ?, ?)',
  )
  const insertPort = db.prepare<[number, number, string]>(
    'INSERT INTO port_reservation (port, worktree_id, subdomain) VALUES (?, ?, ?)',
  )
  const insertRun = db.prepare<[number, string, string, string, string, number]>(
    `INSERT INTO pilot_run (story_id, url, pace, state, script, position, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`,
  )
  const insertAct = db.prepare<[number, number, string, string | null, string, string, string | null]>(
    `INSERT INTO pilot_act (pilot_run_id, position, kind, target, outcome, detail, screenshot_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const markSeeded = db.prepare<[string, string]>(
    'INSERT INTO board_setting (key, value) VALUES (?, ?)',
  )

  const storyIds = new Map<string, number>()
  const references = new Map<string, string>()
  const projectIds = new Map<string, number>()

  for (const project of PLAN) {
    const written = stories.createProject({
      slug: project.slug,
      name: project.name,
      repositoryUrl: `git@github.com:techmefr/${project.slug === 'forge' ? 'forge-ops' : project.slug}.git`,
      integrationBranch: 'main',
      colour: project.colour,
      checkoutPath: project.slug === 'forge' ? process.cwd() : null,
    })
    projectIds.set(project.slug, written.id)
    for (const step of project.steps ?? DEMO_STEPS) {
      workflowColumns.create(written.id, step)
    }
    const epic = stories.createEpic({
      projectId: written.id,
      title: project.epicTitle,
      businessIntent: project.epicIntent,
    })
    stories.claimEpic(epic.id, 'local')
    for (const milestone of milestonesOf(epic.id, projectIds.size)) {
      stories.writeMilestone(milestone)
    }

    for (const plan of project.stories) {
      const story = stories.writeStory({ epicId: epic.id, title: plan.title, body: plan.body })
      stories.writeTwin({
        storyId: story.id,
        title: plan.twinTitle,
        body: `Cas d acceptation de ${story.reference}, ecrits avant le code.`,
      })
      const key = `${project.slug}/${plan.slug}`
      storyIds.set(key, story.id)
      references.set(key, story.reference)

      let index = 0
      for (const criterion of plan.criteria) {
        index += 1
        const declared = criteria.declareCriterion({
          storyId: story.id,
          reference: `${story.reference}-C${index}`,
          statement: criterion.statement,
        })
        if (criterion.met) {
          criteria.satisfyCriterion(declared.id, `.claude/evidence/${story.reference.toLowerCase()}/c${index}.png`)
        }
      }

      if (plan.points !== null) {
        stories.estimate(story.id, plan.points)
      }
      if (plan.state !== 'drafting') {
        stories.sendToBacklog(story.id)
      }
    }
  }


  const epicIds = new Map<string, number>()
  for (const spare of SPARE_EPICS) {
    const projectId = projectIds.get(spare.project)
    if (projectId === undefined) {
      continue
    }
    const epic = stories.createEpic({
      projectId,
      title: spare.title,
      businessIntent: spare.intent,
    })
    if (spare.assignee !== null) {
      stories.claimEpic(epic.id, spare.assignee)
    }
    if (spare.planning !== undefined) {
      stories.epics.plan(epic.id, spare.planning)
    }
    if (spare.lateByDays !== undefined) {
      stories.writeMilestone({ epicId: epic.id, kind: 'demo', dueOn: dayFromNow(-spare.lateByDays) })
    }
    epicIds.set(spare.title, epic.id)
  }
  for (const spare of SPARE_EPICS) {
    const epicId = epicIds.get(spare.title)
    if (epicId === undefined) {
      continue
    }
    const patch: EpicPatch = {
      ...(spare.tags === undefined
        ? {}
        : { tagIds: spare.tags.flatMap((label) => tagIds.get(label) ?? []) }),
      ...(spare.dependsOn === undefined
        ? {}
        : { dependsOn: spare.dependsOn.flatMap((title) => epicIds.get(title) ?? []) }),
      ...(spare.links === undefined ? {} : { links: [...spare.links] }),
    }
    if (Object.keys(patch).length > 0) {
      stories.epics.plan(epicId, patch)
    }
    if (spare.deleted === true) {
      stories.epics.softDelete(epicId, 'local')
    }
  }
  for (const projectId of projectIds.values()) {
    const first = stories.listEpics(projectId)[0]
    if (first === undefined) {
      continue
    }
    stories.epics.plan(first.id, { startedOn: dayFromNow(-24) })
    const slug = [...projectIds.entries()].find(([, id]) => id === projectId)?.[0] ?? ''
    const extras = PROJECT_EXTRAS[slug]
    if (extras !== undefined) {
      const admin = extras.admin === null ? null : identities.findUser(extras.admin)
      if (admin !== null) {
        stories.projects.update(projectId, { adminId: admin.id })
      }
      if (extras.links.length > 0) {
        stories.epics.setProjectLinks(projectId, extras.links)
      }
      for (const event of extras.events) {
        stories.agenda.create({
          type: event.type,
          date: dayFromNow(event.inDays),
          title: event.title,
          projectId,
          epicId: event.onFirstEpic ? first.id : null,
          note: null,
          minutes: event.minutes,
        })
      }
      for (const risk of extras.risks) {
        stories.followUps.openRisk(
          projectId,
          { text: risk.text, level: risk.level, owner: risk.owner, epicId: null },
          dayFromNow(-risk.openedDaysAgo),
        )
      }
      for (const decision of extras.decisions) {
        stories.followUps.recordDecision(
          projectId,
          { text: decision.text, decidedOn: dayFromNow(-decision.daysAgo), decidedBy: decision.by },
          'local',
          dayFromNow(0),
        )
      }
      stories.followUps.changeWeather(projectId, { statusSentence: extras.sentence })
      if (extras.calm) {
        continue
      }
    }
    const agenda = [
      { type: 'steering', inDays: -14, title: 'Steering committee', epicId: null, minutes: 'Priority stays on the first epic. Next review in three weeks.' },
      { type: 'client', inDays: -3, title: 'Client review', epicId: first.id, minutes: null },
      { type: 'production', inDays: 9, title: 'Production release', epicId: first.id, minutes: null },
      { type: 'steering', inDays: 16, title: 'Steering committee', epicId: null, minutes: null },
    ] as const
    for (const event of agenda) {
      stories.agenda.create({
        type: event.type,
        date: dayFromNow(event.inDays),
        title: event.title,
        projectId,
        epicId: event.epicId,
        note: null,
        minutes: event.minutes,
      })
    }
    stories.followUps.openRisk(
      projectId,
      { text: 'The client validation may slip past the release date', level: 'high', owner: null, epicId: first.id },
      dayFromNow(-5),
    )
    stories.followUps.openRisk(
      projectId,
      { text: 'Staging data is not refreshed every week', level: 'low', owner: null, epicId: null },
      dayFromNow(-9),
    )
    stories.followUps.recordDecision(
      projectId,
      { text: 'Release stays on the planned date, scope is frozen', decidedOn: dayFromNow(-14), decidedBy: 'Steering committee' },
      'local',
      dayFromNow(0),
    )
  }
  const sessionOf = new Map<string, string>()
  SESSION_PLAN.forEach((plan, index) => {
    const storyId = storyIds.get(plan.story)
    if (storyId === undefined) {
      return
    }
    const claudeSessionId = `${plan.story.replace('/', '-')}-${plan.phase}-${index}`
    const key = `${plan.story}/${plan.phase}`
    if (!sessionOf.has(key)) {
      sessionOf.set(key, claudeSessionId)
    }
    sessions.registerSession({
      storyId,
      claudeSessionId,
      phase: plan.phase,
      agentName: plan.agentName,
      claudeCodeVersion: '2.1.224',
    })
    sessions.recordUsage(claudeSessionId, {
      costUsd: plan.costUsd,
      inputTokens: plan.inputTokens,
      outputTokens: plan.outputTokens,
    })
    if (plan.exit === null) {
      sessions.updateLifecycle(claudeSessionId, 'working')
    } else {
      sessions.closeSession(claudeSessionId, plan.exit)
    }
    backdateSession.run(-plan.daysAgo, -plan.seconds, -plan.daysAgo, claudeSessionId)
  })

  function workerOn(story: string): string | undefined {
    const phases: readonly AgentPhase[] = ['code', 'tdd', 'architecture', 'gate', 'review', 'spec', 'ship']
    for (const phase of phases) {
      const found = sessionOf.get(`${story}/${phase}`)
      if (found !== undefined) {
        return found
      }
    }
    return undefined
  }

  for (const plan of TOUCH_PLAN) {
    const claudeSessionId = workerOn(plan.story)
    if (claudeSessionId === undefined) {
      continue
    }
    for (const path of plan.paths) {
      sessions.recordFileTouch({ claudeSessionId, path })
    }
  }

  const projects = stories.listProjects()
  for (const zone of ZONE_PLAN) {
    const owner = projects.find((candidate) => candidate.slug === zone.project)
    if (owner === undefined) {
      continue
    }
    zones.declareZone({
      projectId: owner.id,
      pathPrefix: zone.pathPrefix,
      name: zone.name,
      colour: zone.colour,
    })
    zones.summariseZone(
      owner.id,
      zone.pathPrefix,
      describeZone(zones.overviewOfZone(owner.id, zone.pathPrefix)),
    )
  }

  for (const project of PLAN) {
    for (const plan of project.stories) {
      const key = `${project.slug}/${plan.slug}`
      const storyId = storyIds.get(key)
      const reference = references.get(key)
      if (storyId === undefined || reference === undefined || plan.proven === null) {
        continue
      }
      const wanted = PROVEN_UP_TO.slice(0, PROVEN_UP_TO.indexOf(plan.proven) + 1)
      const needsCascade = wanted.includes('reviewed')
      if (needsCascade) {
        for (const lens of REVIEW_LENS_SEQUENCE) {
          const claudeSessionId = `${key.replace('/', '-')}-lens-${lens}`
          sessions.registerSession({
            storyId,
            claudeSessionId,
            phase: 'review',
            agentName: LENS_AGENTS[lens],
            claudeCodeVersion: '2.1.224',
          })
          sessions.recordUsage(claudeSessionId, {
            costUsd: LENS_COST[lens],
            inputTokens: LENS_TOKENS[lens],
            outputTokens: Math.round(LENS_TOKENS[lens] / 8),
          })
          sessions.closeSession(claudeSessionId, { exitCode: 0 })
          backdateSession.run(-2, -LENS_SECONDS[lens], -2, claudeSessionId)
          checkpoints.startLens(storyId, lens, claudeSessionId)
          checkpoints.passLens(storyId, lens)
        }
      }
      for (const name of wanted) {
        checkpoints.proveCheckpoint({ storyId, name, evidencePath: evidenceOf(reference, name) })
      }
    }
  }

  const scopeStory = storyIds.get('forge/scope')
  const pilotStory = storyIds.get('forge/pilot')
  const digestStory = storyIds.get('forge/digest')
  const metricsStory = storyIds.get('forge/metrics')
  const orphanStory = storyIds.get('forge/orphan')
  const writeStory = storyIds.get('mailer/write')
  const deleteStory = storyIds.get('mailer/delete')
  const atlasStory = storyIds.get('atlas/zones')

  if (scopeStory !== undefined) {
    const lensSessionOf = (lens: 'quality' | 'security'): string => {
      const claudeSessionId = `forge-scope-lens-${lens}`
      sessions.registerSession({
        storyId: scopeStory,
        claudeSessionId,
        phase: 'review',
        agentName: LENS_AGENTS[lens],
        claudeCodeVersion: '2.1.224',
      })
      sessions.recordUsage(claudeSessionId, {
        costUsd: LENS_COST[lens],
        inputTokens: LENS_TOKENS[lens],
        outputTokens: Math.round(LENS_TOKENS[lens] / 8),
      })
      return claudeSessionId
    }
    const qualitySession = lensSessionOf('quality')
    const securitySession = lensSessionOf('security')
    sessions.closeSession(qualitySession, { exitCode: 0 })
    backdateSession.run(-1, -LENS_SECONDS.quality, -1, qualitySession)
    backdateSession.run(-1, -LENS_SECONDS.security, -1, securitySession)
    checkpoints.startLens(scopeStory, 'quality', qualitySession)
    checkpoints.passLens(scopeStory, 'quality')
    checkpoints.startLens(scopeStory, 'security', securitySession)
    checkpoints.recordFinding({
      storyId: scopeStory,
      claudeSessionId: securitySession,
      lens: 'security',
      severity: 'weak',
      path: 'backend/src/domain/Foremerge/ScopeGuard.ts',
      line: 42,
      statement: 'un chemin absolu arrive tel quel, il vaudrait mieux le ramener a la racine avant de comparer',
    })
    foremerge.reserve({
      storyId: scopeStory,
      pathPrefix: 'backend/src/domain/Foremerge',
      symbols: ['decideOnWrite', 'ScopeReservation'],
    })
  }

  if (digestStory !== undefined) {
    foremerge.reserve({
      storyId: digestStory,
      pathPrefix: 'backend/src/domain/Zone',
      symbols: ['describeZone', 'ZoneOverview'],
    })
    stories.markMergeConflict(digestStory)
  }

  if (pilotStory !== undefined) {
    foremerge.reserve({
      storyId: pilotStory,
      pathPrefix: 'backend/src/domain/Pilot',
      symbols: ['PilotRun', 'suggestParcours'],
    })
    const worktree = insertWorktree.run(
      pilotStory,
      '/tmp/forge-worktrees/forge-3',
      'story/forge-3-piloter-le-navigateur',
      'forge',
      '9c1d4f2a7b3e5d6c8f0a1b2c3d4e5f60718293a4',
    )
    insertPort.run(4103, Number(worktree.lastInsertRowid), 'forge-3')
    const run = insertRun.run(
      pilotStory,
      'http://localhost:4103/',
      'slow',
      'passed',
      JSON.stringify([
        { kind: 'goto', target: 'http://localhost:4103/' },
        { kind: 'screenshot' },
        { kind: 'click', target: 'text=Avancer' },
        { kind: 'screenshot' },
      ]),
      4,
    )
    const runId = Number(run.lastInsertRowid)
    insertAct.run(runId, 1, 'goto', 'http://localhost:4103/', 'passed', 'la page a repondu en 240 ms', 'pilot-1-1.png')
    insertAct.run(runId, 2, 'screenshot', null, 'passed', 'capture de la vue au chargement', 'pilot-1-2.png')
    insertAct.run(runId, 3, 'click', 'text=Avancer', 'passed', 'le bouton a bien avance le parcours', 'pilot-1-3.png')
    insertAct.run(runId, 4, 'screenshot', null, 'passed', 'capture apres le clic', 'pilot-1-4.png')
  }

  if (metricsStory !== undefined) {
    const worktree = insertWorktree.run(
      metricsStory,
      '/tmp/forge-worktrees/forge-5',
      'story/forge-5-metriques-machine',
      'forge',
      '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
    )
    insertPort.run(4105, Number(worktree.lastInsertRowid), 'forge-5')
  }

  if (writeStory !== undefined) {
    const worktree = insertWorktree.run(
      writeStory,
      '/tmp/forge-worktrees/mailer-2',
      'story/mailer-2-creer-modifier-un-mail',
      'main',
      'f0e1d2c3b4a5968778695a4b3c2d1e0f10203040',
    )
    insertPort.run(4202, Number(worktree.lastInsertRowid), 'mailer-2')
  }

  if (orphanStory !== undefined) {
    setState.run('escalated', 'escalated', orphanStory)
    setEscalation.run(
      "la session a repete deux fois la meme erreur de compilation, le board a coupe et attend une decision",
      orphanStory,
    )
  }

  for (const project of PLAN) {
    for (const plan of project.stories) {
      const storyId = storyIds.get(`${project.slug}/${plan.slug}`)
      if (storyId === undefined || plan.state === 'drafting' || plan.state === 'backlog') {
        continue
      }
      if (plan.state === 'flagged') {
        stories.rollOut(storyId, 25)
        continue
      }
      setState.run(plan.state, plan.state, storyId)
      if (plan.column !== undefined) {
        placeInColumn.run(plan.column, storyId)
      }
    }
  }

  if (writeStory !== undefined && deleteStory !== undefined) {
    stories.addDependency({ blockedStoryId: writeStory, blockingStoryId: deleteStory })
  }
  if (atlasStory !== undefined && pilotStory !== undefined) {
    stories.addDependency({ blockedStoryId: atlasStory, blockingStoryId: pilotStory })
  }

  for (const plan of REMARK_PLAN) {
    const storyId = storyIds.get(plan.story)
    if (storyId === undefined) {
      continue
    }
    discussion.writeRemark({
      storyId,
      author: plan.author,
      voice: plan.voice,
      body: plan.body,
    })
  }

  budget.writePolicy({ capUsd: 25, conduct: 'downgrade', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
  markSeeded.run(MARKER, new Date().toISOString())

  return {
    projects: stories.listProjects().length,
    stories: stories.listKanban().length,
    sessions: SESSION_PLAN.length,
    zones: ZONE_PLAN.length,
  }
}
