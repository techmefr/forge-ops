export type ScreenKey =
  | 'story'
  | 'backlog'
  | 'architecture'
  | 'kanban'
  | 'files'
  | 'review'
  | 'deployment'
  | 'resources'
  | 'statistics'

export type Screen = {
  key: ScreenKey
  n: string
  path: string
  label: string
  tiny: string
  sub: string
}

export const SCREENS: readonly Screen[] = [
  {
    key: 'story',
    n: '01',
    path: '/story',
    label: 'Story',
    tiny: 'sto',
    sub: 'Ecrire la story et sa jumelle de test avec Claude',
  },
  {
    key: 'backlog',
    n: '02',
    path: '/backlog',
    label: 'Backlog',
    tiny: 'bkl',
    sub: 'Les stories pretes, a envoyer en architecture',
  },
  {
    key: 'architecture',
    n: '03',
    path: '/architecture',
    label: 'Architecture',
    tiny: 'arc',
    sub: 'Le plan propose par Claude, a valider ou a renvoyer',
  },
  {
    key: 'kanban',
    n: '04',
    path: '/kanban',
    label: 'Kanban',
    tiny: 'kbn',
    sub: 'L avancement des stories et leurs dependances',
  },
  {
    key: 'files',
    n: '05',
    path: '/files',
    label: 'Fichiers',
    tiny: 'fic',
    sub: 'L architecture qui emerge, zone par zone',
  },
  {
    key: 'review',
    n: '06',
    path: '/review',
    label: 'Test / review',
    tiny: 'rev',
    sub: 'La cascade qualite, securite, accessibilite',
  },
  {
    key: 'deployment',
    n: '07',
    path: '/deployment',
    label: 'Deploiement',
    tiny: 'dep',
    sub: 'Branches, conflits de merge et feature flags',
  },
  {
    key: 'resources',
    n: '08',
    path: '/resources',
    label: 'Ressources',
    tiny: 'res',
    sub: 'Ce que la flotte consomme, et ce qu elle va consommer',
  },
  {
    key: 'statistics',
    n: '09',
    path: '/statistics',
    label: 'Statistiques',
    tiny: 'sta',
    sub: 'L historique des sessions et leurs sorties',
  },
]

export const HOME_PATH = SCREENS[0]?.path ?? '/story'

export function screenOfPath(path: string): Screen | null {
  return SCREENS.find((screen) => path === screen.path || path.startsWith(`${screen.path}/`)) ?? null
}
