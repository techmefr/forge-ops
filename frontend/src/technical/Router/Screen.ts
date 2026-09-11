export const SCREEN_SEQUENCE = [
  'story',
  'backlog',
  'kanban',
  'project',
  'view',
  'deployment',
  'resources',
  'statistics',
] as const

export type ScreenKey = (typeof SCREEN_SEQUENCE)[number]

export type Screen = {
  key: ScreenKey
  digit: string
  path: string
  tiny: string
}

export const SCREENS: readonly Screen[] = [
  { key: 'story', digit: '1', path: '/atelier', tiny: 'atl' },
  { key: 'backlog', digit: '2', path: '/reserve', tiny: 'rsv' },
  { key: 'kanban', digit: '3', path: '/forge', tiny: 'frg' },
  { key: 'project', digit: '4', path: '/project', tiny: 'prj' },
  { key: 'view', digit: '5', path: '/view', tiny: 'vue' },
  { key: 'deployment', digit: '6', path: '/deployment', tiny: 'dep' },
  { key: 'resources', digit: '7', path: '/resources', tiny: 'res' },
  { key: 'statistics', digit: '8', path: '/statistics', tiny: 'sta' },
]

export const HOME_PATH = SCREENS[0]?.path ?? '/atelier'

export function screenOfPath(path: string): Screen | null {
  return SCREENS.find((screen) => path === screen.path || path.startsWith(`${screen.path}/`)) ?? null
}
