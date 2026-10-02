export type ChangedFile = {
  path: string
  status: 'added' | 'modified' | 'deleted'
}

export type TestRun = {
  exitCode: number
  output: string
}

export type StoryInspection = {
  headSha: (root: string) => string
  commitsAhead: (root: string, baseSha: string) => number
  commitLog: (root: string, baseSha: string) => readonly string[]
  uncommittedPaths: (root: string) => readonly string[]
  changedFiles: (root: string, baseSha: string) => readonly ChangedFile[]
  runTests: (root: string) => TestRun
  runTestsWithout: (root: string, baseSha: string, removed: readonly ChangedFile[]) => TestRun
}
