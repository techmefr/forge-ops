import type Database from 'better-sqlite3'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../domain/Checkpoint/CheckpointRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../domain/Checkpoint/PermissiveCheckpointGate.js'
import { createCriterionRepository } from '../domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createZoneRepository } from '../domain/Zone/ZoneRepository.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createDiscussionRepository } from '../domain/Discussion/DiscussionRepository.js'
import { createBudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import type { StoryState } from '../domain/Story/Story.js'
import { STORY_WORKFLOW_ID_SQL } from '../domain/Workflow/ProjectWorkflowRepository.js'
import { createWorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import { CENSUS } from './DemoPlans.js'

export type DemoContext = ReturnType<typeof createDemoContext>

export function createDemoContext(db: Database.Database) {
  const stories = createStoryRepository(db)
  const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => CENSUS,
  })
  const workflowColumns = createWorkflowColumnRepository(db)
  const setState = db.prepare<[StoryState, StoryState, number]>(
    `UPDATE story
        SET state = ?,
            workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                WHERE workflow_column.workflow_id = ${STORY_WORKFLOW_ID_SQL} AND workflow_column.key = ?
            )
      WHERE id = ?`,
  )
  const placeInColumn = db.prepare<[string, number]>(
    `UPDATE story
        SET workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                WHERE workflow_column.workflow_id = ${STORY_WORKFLOW_ID_SQL} AND workflow_column.key = ?
            )
      WHERE id = ?`,
  )
  const setEscalation = db.prepare<[string, number]>('UPDATE story SET escalation_reason = ? WHERE id = ?')
  const backdateSession = db.prepare<[number, number, number, string]>(
    `UPDATE agent_session
        SET started_at = datetime('now', CASE WHEN ended_at IS NULL THEN '0' ELSE ? END || ' days', ? || ' seconds'),
            ended_at = CASE WHEN ended_at IS NULL THEN NULL ELSE datetime('now', ? || ' days') END
      WHERE claude_session_id = ?`,
  )
  const insertWorktree = db.prepare<[number, string, string, string, string]>(
    'INSERT INTO worktree (story_id, path, branch, base_ref, base_sha) VALUES (?, ?, ?, ?, ?)',
  )
  const insertPort = db.prepare<[number, number, string]>(
    'INSERT INTO port_reservation (port, worktree_id, subdomain) VALUES (?, ?, ?)',
  )
  const insertRun = db.prepare<[number, string, string, string, string, number]>(
    `INSERT INTO pilot_run (story_id, url, pace, state, script, position, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`,
  )
  const insertAct = db.prepare<[number, number, string, string | null, string, string, string | null]>(
    `INSERT INTO pilot_act (pilot_run_id, position, kind, target, outcome, detail, screenshot_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const markSeeded = db.prepare<[string, string]>(
    'INSERT INTO board_setting (key, value) VALUES (?, ?)',
  )

  return {
    db,
    stories,
    zones: createZoneRepository(db),
    checkpoints,
    criteria: createCriterionRepository(db),
    sessions: createAgentSessionRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    budget: createBudgetRepository(db),
    discussion: createDiscussionRepository(db, { stories }),
    identities: createIdentityRepository(db),
    workflowColumns,
    setState,
    placeInColumn,
    setEscalation,
    backdateSession,
    insertWorktree,
    insertPort,
    insertRun,
    insertAct,
    markSeeded,
    storyIds: new Map<string, number>(),
    references: new Map<string, string>(),
    projectIds: new Map<string, number>(),
    tagIds: new Map<string, number>(),
  }
}
