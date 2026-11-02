import type { CheckpointName } from '../Checkpoint/Checkpoint.js'
import type { StepBackRecord } from './StepBack.js'
import type { Story, StoryKind, StoryState } from './Story.js'

export type StepBackRow = {
  id: number
  story_id: number
  from_state: StoryState
  to_state: StoryState
  reason: string
  asked_by: string
  revoked_checkpoints: string
  stepped_back_at: string
}

export type StoryRow = {
  id: number
  epic_id: number
  twin_of_story_id: number | null
  reference: string
  title: string
  body: string
  kind: StoryKind
  state: StoryState
  points: number | null
  rollout_percent: number | null
  merge_conflict: number
  escalation_reason: string | null
  blocked_reason: string | null
}

export function toStepBack(row: StepBackRow): StepBackRecord {
  return {
    id: row.id,
    storyId: row.story_id,
    fromState: row.from_state,
    toState: row.to_state,
    reason: row.reason,
    askedBy: row.asked_by,
    revokedCheckpoints:
      row.revoked_checkpoints === '' ? [] : (row.revoked_checkpoints.split(',') as CheckpointName[]),
    steppedBackAt: row.stepped_back_at,
  }
}

export function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    epicId: row.epic_id,
    twinOfStoryId: row.twin_of_story_id,
    reference: row.reference,
    title: row.title,
    body: row.body,
    kind: row.kind,
    state: row.state,
    points: row.points,
    rolloutPercent: row.rollout_percent,
    mergeConflict: row.merge_conflict === 1,
    escalationReason: row.escalation_reason,
    blockedReason: row.blocked_reason,
  }
}
