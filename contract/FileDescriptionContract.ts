export const FILE_DESCRIPTION_KEYS = [
  'packageJson',
  'packageLock',
  'tsconfig',
  'vitestConfig',
  'viteConfig',
  'eslintConfig',
  'databaseSchema',
  'readme',
  'folderDomain',
  'folderTechnical',
  'folderTests',
  'folderSrc',
  'folderBackend',
  'folderFrontend',
  'folderDb',
  'folderPublic',
  'repository',
  'api',
  'violation',
  'screen',
  'panel',
  'testOf',
  'component',
  'technicalBrick',
  'domainFile',
] as const

export type FileDescriptionKey = (typeof FILE_DESCRIPTION_KEYS)[number]

export type FileDescription = {
  key: FileDescriptionKey
  values: Readonly<Record<string, string>>
}
