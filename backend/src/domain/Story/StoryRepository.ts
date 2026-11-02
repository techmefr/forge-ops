import { STORY_WORKFLOW_ID_SQL } from '../Workflow/ProjectWorkflowRepository.js'
import type Database from 'better-sqlite3'
import type { Story, StoryDraft, StoryState, TwinDraft } from './Story.js'
import {
  BlockedByDependencyError,
  PointsOutOfRangeError,
  RolloutOutOfRangeError,
  EmptyBlockedReasonError,
  EmptyCardError,
  StoryNotFoundError,
  TwinAlreadyWrittenError,
  TwinOfTwinError,
  TwinRequiredError,
} from './StoryViolation.js'
import type { HumanGateWait } from './HumanGate.js'
import { HUMAN_GATE_STATES } from './HumanGate.js'
import { createEpicRepository, type EpicRepository } from '../Epic/EpicRepository.js'
import { createEventRepository, type EventRepository } from '../Event/EventRepository.js'
import { createProjectRepository, type ProjectRepository } from '../Project/ProjectRepository.js'
import { createFollowUpRepository, type FollowUpRepository } from '../FollowUp/FollowUpRepository.js'
import { createDependencyRepository, type DependencyRepository } from './DependencyRepository.js'
import { createEpicCatalog, type EpicCatalog } from './EpicCatalog.js'
import { createMilestoneRepository, type MilestoneRepository } from './MilestoneRepository.js'
import { createProjectCatalog, type ProjectCatalog } from './ProjectCatalog.js'
import { createStepBackRepository, type StepBackRepository } from './StepBackRepository.js'
import { toStory, type StoryRow } from './StoryRows.js'
import type { StepBackDraft, StepBackRecord } from './StepBack.js'

export type { CardContext } from './MilestoneRepository.js'

export type StoryPlacement = {
  state: StoryState
  workflowColumnId: number | null
}

export type StoryRepository = ProjectCatalog &
  EpicCatalog &
  MilestoneRepository &
  Pick<DependencyRepository, 'addDependency' | 'listBlockers'> & {
    epics: EpicRepository
    agenda: EventRepository
    projects: ProjectRepository
    followUps: FollowUpRepository
    listHumanGateWaits: () => readonly HumanGateWait[]
    projectOfStory: (storyId: number) => number
    writeStory: (draft: StoryDraft) => Story
    writeTwin: (draft: TwinDraft) => Story
    findStory: (storyId: number) => Story
    findTwin: (storyId: number) => Story | null
    sendToBacklog: (storyId: number) => Story
    markDoneAndUnblock: (storyId: number) => readonly Story[]
    startBuilding: (storyId: number) => Story
    moveToState: (storyId: number, state: StoryState) => Story
    setPlacement: (storyId: number, placement: StoryPlacement) => Story
    stepBack: (draft: StepBackDraft) => StepBackRecord
    listStepBacks: StepBackRepository['list']
    listBacklog: () => readonly Story[]
    listKanban: () => readonly Story[]
    editStory: (storyId: number, draft: { title: string; body: string }) => Story
    estimate: (storyId: number, points: number) => Story
    rollOut: (storyId: number, percent: number) => Story
    markMergeConflict: (storyId: number) => Story
    clearMergeConflict: (storyId: number) => Story
    blockStory: (storyId: number, reason: string) => Story
    unblockStory: (storyId: number) => Story
  }

export type StoryRepositoryOptions = {
  checkoutRoots?: readonly string[]
  now?: () => string
  onBacklog?: (story: Story) => void
}

export function createStoryRepository(
  db: Database.Database,
  { checkoutRoots = [process.cwd()], now, onBacklog }: StoryRepositoryOptions = {},
): StoryRepository {
  const epics = createEpicRepository(db, { now })
  const agenda = createEventRepository(db, { now })
  const projects = createProjectRepository(db, { epics })
  const followUps = createFollowUpRepository(db, { epics, agenda })
  const projectCatalog = createProjectCatalog(db, checkoutRoots)
  const epicCatalog = createEpicCatalog(db, { epics, projects: projectCatalog })
  const milestones = createMilestoneRepository(db)
  const stepBacks = createStepBackRepository(db)

  const insertStory = db.prepare<[number, number | null, string, string, string, Story['kind']]>(
    'INSERT INTO story (epic_id, twin_of_story_id, reference, title, body, kind) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const selectStory = db.prepare<[number], StoryRow>('SELECT * FROM story WHERE id = ?')
  const selectTwin = db.prepare<[number], StoryRow>('SELECT * FROM story WHERE twin_of_story_id = ?')
  const selectProjectOfStory = db.prepare<[number], { project_id: number }>(
    `SELECT epic.project_id AS project_id FROM story
       JOIN epic ON epic.id = story.epic_id
      WHERE story.id = ?`,
  )
  const selectProjectSlug = db.prepare<[number], { slug: string }>(
    'SELECT project.slug AS slug FROM epic JOIN project ON project.id = epic.project_id WHERE epic.id = ?',
  )
  const countFunctionalStories = db.prepare<[number], { total: number }>(
    `SELECT COUNT(*) AS total FROM story
       JOIN epic ON epic.id = story.epic_id
      WHERE epic.project_id = (SELECT project_id FROM epic WHERE id = ?)
        AND story.kind = 'functional'`,
  )
  const updateState = db.prepare<[StoryState, StoryState, number]>(
    `UPDATE story
        SET state = ?,
            workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                WHERE workflow_column.workflow_id = ${STORY_WORKFLOW_ID_SQL} AND workflow_column.key = ?
            ),
            updated_at = datetime('now')
      WHERE id = ?`,
  )
  const updatePlacement = db.prepare<[StoryState, number | null, number]>(
    "UPDATE story SET state = ?, workflow_column_id = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const selectBacklog = db.prepare<[], StoryRow>(
    "SELECT * FROM story WHERE kind = 'functional' AND state = 'backlog' ORDER BY id",
  )
  const selectKanban = db.prepare<[], StoryRow>(
    `SELECT * FROM story
      WHERE kind = 'functional' AND state <> 'drafting'
      ORDER BY id`,
  )
  const updateCard = db.prepare<[string, string, number]>('UPDATE story SET title = ?, body = ? WHERE id = ?')
  const updatePoints = db.prepare<[number, number]>(
    "UPDATE story SET points = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const updateRollout = db.prepare<[number, number]>(
    "UPDATE story SET rollout_percent = ?, state = 'flagged', updated_at = datetime('now') WHERE id = ?",
  )
  const updateMergeConflict = db.prepare<[number, number]>(
    "UPDATE story SET merge_conflict = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const updateBlockedReason = db.prepare<[string | null, number]>(
    "UPDATE story SET blocked_reason = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const selectHumanGateWaits = db.prepare<
    string[],
    { id: number; reference: string; state: StoryState; updated_at: string; waiting_seconds: number }
  >(
    `SELECT id, reference, state, updated_at,
            CAST((julianday('now') - julianday(updated_at)) * 86400 AS INTEGER) AS waiting_seconds
       FROM story
      WHERE kind = 'functional'
        AND state IN (${HUMAN_GATE_STATES.map(() => '?').join(', ')})
      ORDER BY waiting_seconds DESC`,
  )

  function findStory(storyId: number): Story {
    const row = selectStory.get(storyId)
    if (row === undefined) {
      throw new StoryNotFoundError(storyId)
    }
    return toStory(row)
  }

  function findTwin(storyId: number): Story | null {
    const row = selectTwin.get(storyId)
    return row === undefined ? null : toStory(row)
  }

  const dependencies = createDependencyRepository(db, findStory)

  function nextReference(epicId: number): string {
    const project = selectProjectSlug.get(epicId)
    if (project === undefined) {
      throw new StoryNotFoundError(epicId)
    }
    const written = countFunctionalStories.get(epicId)?.total ?? 0
    return `${project.slug.toUpperCase()}-${written + 1}`
  }

  function settle(story: Story): Story {
    epics.recordState(story.epicId)
    return story
  }

  function moveTo(storyId: number, state: StoryState): Story {
    updateState.run(state, state, storyId)
    return settle(findStory(storyId))
  }

  return {
    ...projectCatalog,
    ...epicCatalog,
    ...milestones,
    addDependency: dependencies.addDependency,
    listBlockers: dependencies.listBlockers,
    epics,
    projects,
    agenda,
    followUps,

    projectOfStory: (storyId) => {
      const row = selectProjectOfStory.get(storyId)
      if (row === undefined) {
        throw new StoryNotFoundError(storyId)
      }
      return row.project_id
    },

    listHumanGateWaits: () =>
      selectHumanGateWaits.all(...HUMAN_GATE_STATES).map((row) => ({
        storyId: row.id,
        reference: row.reference,
        state: row.state,
        waitingSince: row.updated_at,
        waitingSeconds: row.waiting_seconds,
      })),

    writeStory: (draft) => {
      const info = insertStory.run(draft.epicId, null, nextReference(draft.epicId), draft.title, draft.body, 'functional')
      return settle(findStory(Number(info.lastInsertRowid)))
    },

    writeTwin: (draft) => {
      const story = findStory(draft.storyId)
      if (story.kind === 'test') {
        throw new TwinOfTwinError(story.reference)
      }
      if (selectTwin.get(story.id) !== undefined) {
        throw new TwinAlreadyWrittenError(story.reference)
      }
      const info = insertStory.run(story.epicId, story.id, `${story.reference}-T`, draft.title, draft.body, 'test')
      return findStory(Number(info.lastInsertRowid))
    },

    findStory,
    findTwin,

    sendToBacklog: (storyId) => {
      const story = findStory(storyId)
      const twin = selectTwin.get(story.id)
      if (story.kind === 'functional' && twin === undefined) {
        throw new TwinRequiredError(story.reference)
      }
      if (twin !== undefined) {
        moveTo(twin.id, 'backlog')
      }
      const backlogged = moveTo(story.id, 'backlog')
      if (backlogged.kind === 'functional') {
        onBacklog?.(backlogged)
      }
      return backlogged
    },

    markDoneAndUnblock: (storyId) => {
      moveTo(storyId, 'done')
      return dependencies.listFreedBy(storyId).map(findStory)
    },

    startBuilding: (storyId) => {
      const story = findStory(storyId)
      const blockers = dependencies.listBlockers(story.id)
      if (blockers.length > 0) {
        throw new BlockedByDependencyError(story.reference, blockers)
      }
      return moveTo(story.id, 'building')
    },

    moveToState: (storyId, state) => moveTo(findStory(storyId).id, state),

    setPlacement: (storyId, placement) => {
      const story = findStory(storyId)
      updatePlacement.run(placement.state, placement.workflowColumnId, story.id)
      return findStory(story.id)
    },

    stepBack: (draft) => {
      const story = findStory(draft.storyId)
      const record = stepBacks.record(draft, story.state)
      moveTo(story.id, draft.toState)
      return record
    },

    listStepBacks: stepBacks.list,

    listBacklog: () => selectBacklog.all().map(toStory),

    listKanban: () => selectKanban.all().map(toStory),

    editStory: (storyId, draft) => {
      const story = findStory(storyId)
      const title = draft.title.trim()
      const body = draft.body.trim()
      if (title === '' || body === '') {
        throw new EmptyCardError(story.reference)
      }
      updateCard.run(title, body, story.id)
      return findStory(story.id)
    },

    estimate: (storyId, points) => {
      const story = findStory(storyId)
      if (!Number.isInteger(points) || points <= 0) {
        throw new PointsOutOfRangeError(points)
      }
      updatePoints.run(points, story.id)
      return findStory(story.id)
    },

    rollOut: (storyId, percent) => {
      const story = findStory(storyId)
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
        throw new RolloutOutOfRangeError(percent)
      }
      updateRollout.run(percent, story.id)
      return settle(findStory(story.id))
    },

    markMergeConflict: (storyId) => {
      const story = findStory(storyId)
      updateMergeConflict.run(1, story.id)
      return findStory(story.id)
    },

    clearMergeConflict: (storyId) => {
      const story = findStory(storyId)
      updateMergeConflict.run(0, story.id)
      return findStory(story.id)
    },

    blockStory: (storyId, reason) => {
      const story = findStory(storyId)
      const trimmed = reason.trim()
      if (trimmed === '') {
        throw new EmptyBlockedReasonError(story.reference)
      }
      updateBlockedReason.run(trimmed, story.id)
      return settle(findStory(story.id))
    },

    unblockStory: (storyId) => {
      const story = findStory(storyId)
      updateBlockedReason.run(null, story.id)
      return settle(findStory(story.id))
    },
  }
}
