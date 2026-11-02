import type Database from 'better-sqlite3'
import type { EpicPlanning, EpicState, LinkKind, ManualEpicState } from '../../../../contract/EpicContract.js'
import type { MilestoneKind } from '../../../../contract/StoryContract.js'
import type { StoryCensus } from './EpicPlan.js'
import type { TagRow } from './TagCatalog.js'

export type EpicRow = {
  id: number
  project_id: number
  title: string
  priority: EpicPlanning['priority']
  started_on: string | null
  status_note: string | null
  requested_by: string | null
  deleted_at: string | null
  manual_state: ManualEpicState | null
}

export type CensusRow = { epic_id: number; total: number; delivered: number; started: number; blocked: number }
export type EpicTagRow = TagRow & { epic_id: number }
export type LinkRow = { owner_id: number; kind: LinkKind; url: string }
export type DependencyRow = { epic_id: number; depends_on_epic_id: number }
export type MilestoneRow = { epic_id: number; kind: MilestoneKind; due_on: string }
export type EventRow = { epic_id: number; kind: MilestoneKind; due_on: string; title: string }
export type HistoryRow = { epic_id: number; state: EpicState; at: string; by: string }

export const EMPTY_CENSUS: StoryCensus = { total: 0, delivered: 0, started: 0, blocked: 0 }

export type EpicReads = ReturnType<typeof prepareEpicReads>
export type EpicWrites = ReturnType<typeof prepareEpicWrites>

const CENSUS_COLUMNS = `COUNT(story.id) AS total,
            COALESCE(SUM(story.state = 'done'), 0) AS delivered,
            COALESCE(SUM(story.state NOT IN ('drafting', 'backlog', 'done')), 0) AS started,
            COALESCE(SUM(story.state <> 'done' AND (story.blocked_reason IS NOT NULL OR story.state = 'escalated')), 0) AS blocked`

export function prepareEpicReads(db: Database.Database) {
  return {
    selectEpic: db.prepare<[number], EpicRow>(
      `SELECT id, project_id, title, priority, started_on, status_note, requested_by, deleted_at, manual_state
         FROM epic WHERE id = ?`,
    ),
    selectEpicsOfProject: db.prepare<[number, number], EpicRow>(
      `SELECT id, project_id, title, priority, started_on, status_note, requested_by, deleted_at, manual_state
         FROM epic WHERE project_id = ? AND (deleted_at IS NOT NULL) = ? ORDER BY id`,
    ),
    selectCensusOfProject: db.prepare<[number], CensusRow>(
      `SELECT epic.id AS epic_id, ${CENSUS_COLUMNS}
         FROM epic
         LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
        WHERE epic.project_id = ?
        GROUP BY epic.id`,
    ),
    selectCensusOfEpic: db.prepare<[number], CensusRow>(
      `SELECT epic.id AS epic_id, ${CENSUS_COLUMNS}
         FROM epic
         LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
        WHERE epic.id = ?
        GROUP BY epic.id`,
    ),
    selectTagsOfProject: db.prepare<[number], EpicTagRow>(
      `SELECT epic_tag.epic_id AS epic_id, tag.id AS id, tag.label AS label, tag.colour AS colour,
              (SELECT COUNT(*) FROM epic_tag AS used WHERE used.tag_id = tag.id) AS usage
         FROM epic_tag
         JOIN tag ON tag.id = epic_tag.tag_id
         JOIN epic ON epic.id = epic_tag.epic_id
        WHERE epic.project_id = ?
        ORDER BY tag.label`,
    ),
    selectLinksOfProject: db.prepare<[number], LinkRow>(
      `SELECT epic_link.epic_id AS owner_id, epic_link.kind AS kind, epic_link.url AS url
         FROM epic_link JOIN epic ON epic.id = epic_link.epic_id
        WHERE epic.project_id = ? ORDER BY epic_link.id`,
    ),
    selectDependenciesOfProject: db.prepare<[number], DependencyRow>(
      `SELECT epic_dependency.epic_id, epic_dependency.depends_on_epic_id
         FROM epic_dependency JOIN epic ON epic.id = epic_dependency.epic_id
        WHERE epic.project_id = ? ORDER BY epic_dependency.depends_on_epic_id`,
    ),
    selectEveryDependency: db.prepare<[], DependencyRow>('SELECT epic_id, depends_on_epic_id FROM epic_dependency'),
    selectMilestonesOfProject: db.prepare<[number], MilestoneRow>(
      `SELECT epic_milestone.epic_id, epic_milestone.kind, epic_milestone.due_on
         FROM epic_milestone JOIN epic ON epic.id = epic_milestone.epic_id
        WHERE epic.project_id = ? AND epic_milestone.kind IN ('demo', 'production', 'everyone')`,
    ),
    selectEventsOfProject: db.prepare<[number, string], EventRow>(
      `SELECT epic_milestone.epic_id, epic_milestone.kind, epic_milestone.due_on, epic_milestone.title
         FROM epic_milestone JOIN epic ON epic.id = epic_milestone.epic_id
        WHERE epic.project_id = ? AND epic_milestone.due_on >= ?
        ORDER BY epic_milestone.due_on, epic_milestone.id`,
    ),
    selectHistoryOfProject: db.prepare<[number], HistoryRow>(
      `SELECT epic_state_history.epic_id, epic_state_history.state, epic_state_history.at, epic_state_history.by
         FROM epic_state_history JOIN epic ON epic.id = epic_state_history.epic_id
        WHERE epic.project_id = ? ORDER BY epic_state_history.id`,
    ),
    selectHistory: db.prepare<[number], HistoryRow>(
      'SELECT epic_id, state, at, by FROM epic_state_history WHERE epic_id = ? ORDER BY id',
    ),
    selectLastState: db.prepare<[number], { state: EpicState }>(
      'SELECT state FROM epic_state_history WHERE epic_id = ? ORDER BY id DESC LIMIT 1',
    ),
    selectTag: db.prepare<[number], { id: number }>('SELECT id FROM tag WHERE id = ?'),
    selectExpired: db.prepare<[string], { id: number }>(
      `SELECT epic.id FROM epic
        WHERE epic.deleted_at IS NOT NULL AND epic.deleted_at <= ?
          AND NOT EXISTS (SELECT 1 FROM story WHERE story.epic_id = epic.id)`,
    ),
  }
}

export function prepareEpicWrites(db: Database.Database) {
  return {
    insertHistory: db.prepare<[number, EpicState, string, string]>(
      'INSERT INTO epic_state_history (epic_id, state, at, by) VALUES (?, ?, ?, ?)',
    ),
    deleteEpicTags: db.prepare<[number]>('DELETE FROM epic_tag WHERE epic_id = ?'),
    insertEpicTag: db.prepare<[number, number]>('INSERT INTO epic_tag (epic_id, tag_id) VALUES (?, ?)'),
    deleteEpicLinks: db.prepare<[number]>('DELETE FROM epic_link WHERE epic_id = ?'),
    insertEpicLink: db.prepare<[number, LinkKind, string]>('INSERT INTO epic_link (epic_id, kind, url) VALUES (?, ?, ?)'),
    deleteOwnDependencies: db.prepare<[number]>('DELETE FROM epic_dependency WHERE epic_id = ?'),
    insertDependency: db.prepare<[number, number]>(
      'INSERT INTO epic_dependency (epic_id, depends_on_epic_id) VALUES (?, ?)',
    ),
    updateManualState: db.prepare<[ManualEpicState, number]>('UPDATE epic SET manual_state = ? WHERE id = ?'),
    markDeleted: db.prepare<[string | null, number]>('UPDATE epic SET deleted_at = ? WHERE id = ?'),
  }
}
