export type TaskStatus =
  | 'created'
  | 'testing'
  | 'failed'
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
  heartbeat: string | null
  contextSummary: string | null
  attemptCount: number
  actionCount: number
  lastErrorHash: string | null
  recommendedModel: string | null
  currentModel: string | null
  escalationReason: string | null
  createdAt: string
  updatedAt: string
}
