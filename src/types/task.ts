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
