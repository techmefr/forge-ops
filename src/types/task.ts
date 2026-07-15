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

export interface ITask {
  id: number
  branch: string
  port: number
  status: TaskStatus
  lastCheckpoint: TaskCheckpoint | null
  contextSummary: string | null
  escalationReason: string | null
  createdAt: string
  updatedAt: string
}
