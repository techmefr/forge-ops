export type TaskStatus =
  | 'created'
  | 'in_progress'
  | 'done'
  | 'escalated'
  | 'awaiting_human'

export type TaskCheckpoint =
  | 'spec_done'
  | 'plan_done'
  | 'tests_written'
  | 'build_done'
  | 'reviewed'
  | 'simplified'
  | 'mr_draft_pushed'

export type ArchStatus = 'planned' | 'in_progress' | 'done'

export interface IArchNode {
  id: number
  project: string
  path: string
  purpose: string | null
  status: ArchStatus
  feature: string | null
  createdAt: string
  updatedAt: string
}

export interface ITaskItem {
  id: number
  taskId: number
  label: string
  done: boolean
  createdAt: string
}

export type FileState = 'touched' | 'in_progress' | 'planned'

export interface IActivityEvent {
  id: number
  project: string | null
  branch: string | null
  worktreePath: string | null
  session: string | null
  tool: string
  filePath: string | null
  createdAt: string
}

export interface IConflict {
  id: number
  project: string
  leftBranch: string
  rightBranch: string
  filePath: string
  promoted: boolean
  arbitration: string | null
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt: string | null
}

export interface IWorktreeFiles {
  touched: string[]
  inProgress: string[]
  planned: string[]
}

export interface IWorktreeView {
  project: string
  branch: string
  isMain: boolean
  tracked: boolean
  missing: boolean
  port: number | null
  feature: string | null
  role: string | null
  status: TaskStatus
  lastCheckpoint: TaskCheckpoint | null
  repoPath: string | null
  worktreePath: string | null
  base: string | null
  head: string | null
  clean: boolean
  files: IWorktreeFiles
  lastActivity: IActivityEvent | null
  idle: boolean
  detail: string | null
}

export interface IFileOwner {
  branch: string
  worktreePath: string | null
  state: FileState
}

export interface IFileRow {
  project: string
  path: string
  owners: IFileOwner[]
  shared: boolean
}

export interface ITask {
  id: number
  project: string
  branch: string
  port: number
  repoPath: string | null
  worktreePath: string | null
  runCommand: string | null
  pid: number | null
  feature: string | null
  role: string | null
  status: TaskStatus
  lastCheckpoint: TaskCheckpoint | null
  contextSummary: string | null
  escalationReason: string | null
  createdAt: string
  updatedAt: string
  items?: ITaskItem[]
}
