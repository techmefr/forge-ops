import { SCREENS, type ScreenKey } from '../Router/Screen.js'

export const LANGUAGES = ['fr', 'en'] as const

export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_LABELS: Readonly<Record<Language, string>> = {
  fr: 'Francais',
  en: 'English',
}

export const LANGUAGE_STORAGE_KEY = 'forge.language'

export type ScreenText = {
  label: string
  sub: string
}

const ENGLISH: Readonly<Record<ScreenKey, ScreenText>> = {
  story: {
    label: 'Story',
    sub: 'Start from a director epic, write the story and its test twin',
  },
  backlog: {
    label: 'Backlog',
    sub: 'Pick the stories for the session about to be launched',
  },
  architecture: {
    label: 'Architecture',
    sub: 'The plan Claude proposes, to accept or to send back',
  },
  kanban: {
    label: 'Kanban',
    sub: 'Follow every story through its steps and its dependencies',
  },
  project: {
    label: 'Project',
    sub: 'Walk the files, learn what they serve and who edits them',
  },
  review: {
    label: 'Review',
    sub: 'Read the diffs and the quality, security, accessibility cascade',
  },
  view: {
    label: 'View',
    sub: 'See the rendering and try the front of each working session',
  },
  deployment: {
    label: 'Deployment',
    sub: 'Where delivery stands, branches, conflicts and CI/CD steps',
  },
  resources: {
    label: 'Resources',
    sub: 'What the machine burns, and what it is about to burn',
  },
  statistics: {
    label: 'Statistics',
    sub: 'What the launched work yields, session by session',
  },
}

const FRENCH: Readonly<Record<ScreenKey, ScreenText>> = Object.fromEntries(
  SCREENS.map((screen) => [screen.key, { label: screen.label, sub: screen.sub }]),
) as Readonly<Record<ScreenKey, ScreenText>>

const TEXTS: Readonly<Record<Language, Readonly<Record<ScreenKey, ScreenText>>>> = {
  fr: FRENCH,
  en: ENGLISH,
}

export function screenTextOf(key: ScreenKey, language: Language): ScreenText {
  return TEXTS[language][key]
}

export const SHELL_KEYS = [
  'pipeline',
  'orchestration',
  'incidents',
  'settings',
  'settingsSub',
  'incidentsSub',
  'access',
  'accessSub',
  'agents',
  'noSession',
] as const

export type ShellKey = (typeof SHELL_KEYS)[number]

const SHELL_TEXT: Readonly<Record<Language, Readonly<Record<ShellKey, string>>>> = {
  fr: {
    pipeline: 'Etapes du pipeline',
    orchestration: 'Orchestration d agents',
    incidents: 'Signalements',
    settings: 'Reglages',
    settingsSub: 'Le compte, l apparence, la langue et le plafond de cout',
    incidentsSub: 'Ce qui remonte du dehors, a trancher un par un',
    access: 'Acces',
    accessSub: 'Ouvrir une session sur le board',
    agents: 'Agents actifs',
    noSession: 'Aucune session en cours',
  },
  en: {
    pipeline: 'Pipeline steps',
    orchestration: 'Agent orchestration',
    incidents: 'Reports',
    settings: 'Settings',
    settingsSub: 'The account, the look, the language and the cost cap',
    incidentsSub: 'What comes from outside, to settle one by one',
    access: 'Access',
    accessSub: 'Open a session on the board',
    agents: 'Working agents',
    noSession: 'No session running',
  },
}

export function shellTextOf(key: ShellKey, language: Language): string {
  return SHELL_TEXT[language][key]
}
