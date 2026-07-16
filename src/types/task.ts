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
