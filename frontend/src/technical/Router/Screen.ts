export type ScreenKey =
  | 'story'
  | 'backlog'
  | 'kanban'
  | 'project'
  | 'view'
  | 'deployment'
  | 'resources'
  | 'statistics'

export type Screen = {
  key: ScreenKey
  digit: string
  path: string
  label: string
  tiny: string
  sub: string
}

export const SCREENS: readonly Screen[] = [
  {
    key: 'story',
    digit: '1',
    path: '/atelier',
    label: 'Atelier',
    tiny: 'atl',
    sub: 'Partir d une epique du directeur, decouper la story et sa jumelle de test',
  },
  {
    key: 'backlog',
    digit: '2',
    path: '/reserve',
    label: 'Reserve',
    tiny: 'rsv',
    sub: 'Les pieces pretes : grouper les stories de la prochaine fournee',
  },
  {
    key: 'kanban',
    digit: '3',
    path: '/forge',
    label: 'Forge',
    tiny: 'frg',
    sub: 'Le plan, le dev, la review et la livraison de chaque story, colonne par colonne',
  },
  {
    key: 'project',
    digit: '4',
    path: '/project',
    label: 'Projet',
    tiny: 'prj',
    sub: 'Naviguer dans les fichiers, savoir a quoi ils servent et qui les edite',
  },
  {
    key: 'view',
    digit: '5',
    path: '/view',
    label: 'View',
    tiny: 'vue',
    sub: 'Voir le rendu et tester le front de chaque session de travail',
  },
  {
    key: 'deployment',
    digit: '6',
    path: '/deployment',
    label: 'Deploiement',
    tiny: 'dep',
    sub: 'Ou en est la livraison, branches, conflits et etapes de CI/CD',
  },
  {
    key: 'resources',
    digit: '7',
    path: '/resources',
    label: 'Ressources',
    tiny: 'res',
    sub: 'Ce que la machine consomme, et ce qu elle va consommer',
  },
  {
    key: 'statistics',
    digit: '8',
    path: '/statistics',
    label: 'Statistiques',
    tiny: 'sta',
    sub: 'Ce que donne le travail lance, session par session',
  },
]

export const HOME_PATH = SCREENS[0]?.path ?? '/atelier'

export function screenOfPath(path: string): Screen | null {
  return SCREENS.find((screen) => path === screen.path || path.startsWith(`${screen.path}/`)) ?? null
}
