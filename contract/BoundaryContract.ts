export const CONTRACT_VERSION = '1.0.0'

export const SIDES = ['server', 'instance'] as const

export type Side = (typeof SIDES)[number]

export const SERVER_HELD: readonly string[] = [
  'organisation',
  'auth_provider',
  'board_user',
  'user_preference',
  'project',
  'epic',
  'story',
  'story_dependency',
  'acceptance_criterion',
  'epic_milestone',
  'tag',
  'epic_tag',
  'epic_link',
  'project_link',
  'project_risk',
  'project_decision',
  'epic_dependency',
  'epic_state_history',
  'column_template',
  'template_column',
  'project_template',
  'merge_batch',
  'batch_story',
]

export const INSTANCE_HELD: readonly string[] = [
  'agent_session',
  'story_step_back',
  'zone',
  'incident_origin',
  'incident',
  'board_session',
  'board_setting',
  'workflow_column',
  'autopilot_setting',
  'autopilot_card',
  'scope_reservation',
  'worktree',
  'forge_card',
  'forge_card_story',
  'port_reservation',
  'file_touch',
  'checkpoint',
  'review_pass',
  'review_finding',
  'test_census',
  'story_remark',
  'story_message',
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
