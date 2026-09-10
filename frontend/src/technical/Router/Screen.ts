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
    path: '/story',
    label: 'Story',
    tiny: 'sto',
    sub: 'Partir d une epique du directeur, ecrire la story et sa jumelle de test',
  },
  {
    key: 'backlog',
    digit: '2',
    path: '/backlog',
    label: 'Backlog',
    tiny: 'bkl',
    sub: 'Choisir les stories de la session qu on veut lancer',
  },
  {
    key: 'kanban',
    digit: '3',
    path: '/kanban',
    label: 'Kanban',
    tiny: 'kbn',
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

export const HOME_PATH = SCREENS[0]?.path ?? '/story'

export function screenOfPath(path: string): Screen | null {
  return SCREENS.find((screen) => path === screen.path || path.startsWith(`${screen.path}/`)) ?? null
}
