const ROOT_FILES: Readonly<Record<string, string>> = {
  'package.json': 'Dépendances et scripts du dépôt',
  'package-lock.json': 'Versions exactes installées',
  'tsconfig.json': 'Réglages TypeScript',
  'vitest.config.ts': 'Réglages des tests',
  'vite.config.ts': 'Réglages du build front',
  'eslint.config.js': 'Règles de lint',
  'db/forge.sql': 'Schéma de la base',
  'README.md': 'Présentation du dépôt',
}

const FOLDERS: Readonly<Record<string, string>> = {
  domain: 'Le métier, un dossier par sujet',
  technical: 'Les briques techniques, sans métier',
  tests: 'Les tests',
  src: 'Le code source',
  backend: 'Le serveur du board',
  frontend: 'L interface du board',
  db: 'La base et son schéma',
  public: 'Les fichiers servis tels quels',
}

function pluralOf(word: string): string {
  return word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`
}

const SUFFIXES: readonly (readonly [string, (subject: string, area: string) => string])[] = [
  ['Repository', (subject) => `Accès base de données des ${pluralOf(subject.toLowerCase())}`],
  ['Api', (subject) => `Routes http des ${pluralOf(subject.toLowerCase())}`],
  ['Violation', (subject) => `Refus possibles du domaine ${subject}`],
  ['Screen', (subject) => `Écran ${subject}`],
  ['Panel', (subject) => `Panneau ${subject}`],
]

function bare(name: string): string {
  return name.replace(/\.(ts|vue|js|sql|md|json|css)$/, '')
}

function subjectOf(path: string): string {
  return path.split('/').slice(0, -1).pop() ?? ''
}

export function describeFile(path: string): string {
  const known = ROOT_FILES[path]
  if (known !== undefined) {
    return known
  }

  const name = path.split('/').pop() ?? ''
  if (!name.includes('.')) {
    return FOLDERS[name] ?? ''
  }

  if (name.endsWith('.test.ts')) {
    return `Tests de ${bare(name.replace('.test.ts', ''))}`
  }

  const stem = bare(name)
  for (const [suffix, say] of SUFFIXES) {
    if (stem.endsWith(suffix) && stem !== suffix) {
      return say(stem.slice(0, -suffix.length), subjectOf(path))
    }
  }

  if (name.endsWith('.vue')) {
    return `Composant ${stem}`
  }

  if (path.includes('/technical/')) {
    return `Brique technique ${subjectOf(path)}`
  }

  if (path.includes('/domain/')) {
    return `Métier ${subjectOf(path)} : ${stem}`
  }

  return ''
}
