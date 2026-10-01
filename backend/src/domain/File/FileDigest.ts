import type { FileDescription, FileDescriptionKey } from '../../../../contract/FileDescriptionContract.js'

const ROOT_FILES: Readonly<Record<string, FileDescriptionKey>> = {
  'package.json': 'packageJson',
  'package-lock.json': 'packageLock',
  'tsconfig.json': 'tsconfig',
  'vitest.config.ts': 'vitestConfig',
  'vite.config.ts': 'viteConfig',
  'eslint.config.js': 'eslintConfig',
  'db/forge.sql': 'databaseSchema',
  'README.md': 'readme',
}

const FOLDERS: Readonly<Record<string, FileDescriptionKey>> = {
  domain: 'folderDomain',
  technical: 'folderTechnical',
  tests: 'folderTests',
  src: 'folderSrc',
  backend: 'folderBackend',
  frontend: 'folderFrontend',
  db: 'folderDb',
  public: 'folderPublic',
}

const SUFFIXES: readonly (readonly [string, FileDescriptionKey])[] = [
  ['Repository', 'repository'],
  ['Api', 'api'],
  ['Violation', 'violation'],
  ['Screen', 'screen'],
  ['Panel', 'panel'],
]

function bare(name: string): string {
  return name.replace(/\.(ts|vue|js|sql|md|json|css)$/, '')
}

function subjectOf(path: string): string {
  return path.split('/').slice(0, -1).pop() ?? ''
}

function described(key: FileDescriptionKey, values: Readonly<Record<string, string>> = {}): FileDescription {
  return { key, values }
}

export function describeFile(path: string): FileDescription | null {
  const known = ROOT_FILES[path]
  if (known !== undefined) {
    return described(known)
  }

  const name = path.split('/').pop() ?? ''
  if (!name.includes('.')) {
    const folder = FOLDERS[name]
    return folder === undefined ? null : described(folder)
  }

  if (name.endsWith('.test.ts')) {
    return described('testOf', { name: bare(name.replace('.test.ts', '')) })
  }

  const stem = bare(name)
  for (const [suffix, key] of SUFFIXES) {
    if (stem.endsWith(suffix) && stem !== suffix) {
      return described(key, { subject: stem.slice(0, -suffix.length) })
    }
  }

  if (name.endsWith('.vue')) {
    return described('component', { name: stem })
  }

  if (path.includes('/technical/')) {
    return described('technicalBrick', { area: subjectOf(path) })
  }

  if (path.includes('/domain/')) {
    return described('domainFile', { area: subjectOf(path), name: stem })
  }

  return null
}
