export const SCREEN_SEQUENCE = ['projects', 'personal', 'settings', 'statistics'] as const

export type ScreenKey = (typeof SCREEN_SEQUENCE)[number]

export type Screen = {
  key: ScreenKey
  digit: string
  path: string
  tiny: string
}

export const SCREENS: readonly Screen[] = [
  { key: 'projects', digit: '1', path: '/projects', tiny: 'prj' },
  { key: 'personal', digit: '2', path: '/me', tiny: 'moi' },
  { key: 'settings', digit: '3', path: '/settings', tiny: 'reg' },
  { key: 'statistics', digit: '4', path: '/statistics', tiny: 'sta' },
]

export const HOME_PATH = SCREENS[0]?.path ?? '/projects'

export const ABSORBED_PATHS: Readonly<Record<string, string>> = {
  '/atelier': '/me/stories',
  '/reserve': '/projects/backlog',
  '/forge': '/projects/board',
  '/deployment': '/projects/deployment',
  '/incidents': '/me/stories',
  '/project': '/me/files',
  '/view': '/me/view',
  '/resources': '/me/resources',
}

export function screenOfPath(path: string): Screen | null {
  return SCREENS.find((screen) => path === screen.path || path.startsWith(`${screen.path}/`)) ?? null
}
