export type ScreenKey =
  | 'story'
  | 'backlog'
  | 'architecture'
  | 'kanban'
  | 'project'
  | 'review'
  | 'view'
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
    sub: 'Partir d une epique du directeur, ecrire la story et sa jumelle de test',
  },
  {
    key: 'backlog',
    n: '02',
    path: '/backlog',
    label: 'Backlog',
    tiny: 'bkl',
    sub: 'Choisir les stories de la session qu on veut lancer',
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
    sub: 'Suivre les etapes de chaque story et leurs dependances',
  },
  {
    key: 'project',
    n: '05',
    path: '/project',
    label: 'Projet',
    tiny: 'prj',
    sub: 'Naviguer dans les fichiers, savoir a quoi ils servent et qui les edite',
  },
  {
    key: 'review',
    n: '06',
    path: '/review',
    label: 'Review',
    tiny: 'rev',
    sub: 'Lire les diffs et la cascade qualite, securite, accessibilite',
  },
  {
    key: 'view',
    n: '07',
    path: '/view',
    label: 'View',
    tiny: 'vue',
    sub: 'Voir le rendu et tester le front de chaque session de travail',
  },
  {
    key: 'deployment',
    n: '08',
    path: '/deployment',
    label: 'Deploiement',
    tiny: 'dep',
    sub: 'Ou en est la livraison, branches, conflits et etapes de CI/CD',
  },
  {
    key: 'resources',
    n: '09',
    path: '/resources',
    label: 'Ressources',
    tiny: 'res',
    sub: 'Ce que la machine consomme, et ce qu elle va consommer',
  },
  {
    key: 'statistics',
    n: '10',
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
