export const CONTRACT_VERSION = '1.0.0'

export const SIDES = ['server', 'instance'] as const

export type Side = (typeof SIDES)[number]

export const SERVER_HELD: readonly string[] = [
  'organisation',
  'auth_provider',
  'board_user',
  'project',
  'epic',
  'story',
  'story_dependency',
  'acceptance_criterion',
  'epic_milestone',
  'column_template',
  'template_column',
  'project_template',
]

export const INSTANCE_HELD: readonly string[] = [
  'agent_session',
  'story_step_back',
  'zone',
  'incident_origin',
  'incident',
  'board_session',
  'board_setting',
  'scope_reservation',
  'worktree',
  'port_reservation',
  'file_touch',
  'checkpoint',
  'review_pass',
  'review_finding',
  'test_census',
  'story_remark',
  'story_hold',
  'pilot_run',
  'pilot_act',
  'instance_token',
  'sync_outbox',
]

export const AGREEMENTS = ['compatible', 'instanceTooOld', 'serverTooOld'] as const

export type Agreement = (typeof AGREEMENTS)[number]

export type Announcement = {
  installed: string
  offered: string
  wouldInstall: boolean
}

export type OutboxEntry = {
  id: number
  kind: string
  payload: string
  queuedAt: string
  sentAt: string | null
  attempts: number
}
