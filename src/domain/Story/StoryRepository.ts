import type Database from 'better-sqlite3'
import type {
  Dependency,
  Epic,
  EpicDraft,
  Project,
  ProjectDraft,
  Story,
  StoryDraft,
  StoryKind,
  StoryState,
  TwinDraft,
} from './Story.js'
import {
  BlockedByDependencyError,
  PointsOutOfRangeError,
  RolloutOutOfRangeError,
  SelfDependencyError,
  StoryNotFoundError,
  TwinAlreadyWrittenError,
  TwinOfTwinError,
  TwinRequiredError,
} from './StoryViolation.js'

type StoryRow = {
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
}

export type StoryRepository = {
  createProject: (draft: ProjectDraft) => Project
  createEpic: (draft: EpicDraft) => Epic
  writeStory: (draft: StoryDraft) => Story
  writeTwin: (draft: TwinDraft) => Story
  findStory: (storyId: number) => Story
  sendToBacklog: (storyId: number) => Story
  addDependency: (dependency: Dependency) => void
  startBuilding: (storyId: number) => Story
  markDone: (storyId: number) => Story
  listBacklog: () => readonly Story[]
  estimate: (storyId: number, points: number) => Story
  rollOut: (storyId: number, percent: number) => Story
  markMergeConflict: (storyId: number) => Story
  clearMergeConflict: (storyId: number) => Story
}

function toStory(row: StoryRow): Story {
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
  }
}

export function createStoryRepository(db: Database.Database): StoryRepository {
  const insertProject = db.prepare<[string, string, string, string, string]>(
    'INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)',
  )
  const insertEpic = db.prepare<[number, string, string]>(
    'INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)',
  )
  const insertStory = db.prepare<[number, number | null, string, string, string, StoryKind]>(
    'INSERT INTO story (epic_id, twin_of_story_id, reference, title, body, kind) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const selectStory = db.prepare<[number], StoryRow>('SELECT * FROM story WHERE id = ?')
  const selectTwin = db.prepare<[number], StoryRow>('SELECT * FROM story WHERE twin_of_story_id = ?')
  const selectProjectSlug = db.prepare<[number], { slug: string }>(
    'SELECT project.slug AS slug FROM epic JOIN project ON project.id = epic.project_id WHERE epic.id = ?',
  )
  const countFunctionalStories = db.prepare<[number], { total: number }>(
    `SELECT COUNT(*) AS total FROM story
       JOIN epic ON epic.id = story.epic_id
      WHERE epic.project_id = (SELECT project_id FROM epic WHERE id = ?)
        AND story.kind = 'functional'`,
  )
  const insertDependency = db.prepare<[number, number]>(
    'INSERT INTO story_dependency (blocked_story_id, blocking_story_id) VALUES (?, ?)',
  )
  const selectUnresolvedBlockers = db.prepare<[number], { reference: string }>(
    `SELECT story.reference AS reference FROM story_dependency
       JOIN story ON story.id = story_dependency.blocking_story_id
      WHERE story_dependency.blocked_story_id = ?
        AND story.state <> 'done'
      ORDER BY story.reference`,
  )
  const updateState = db.prepare<[StoryState, number]>(
    "UPDATE story SET state = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const selectBacklog = db.prepare<[], StoryRow>(
    "SELECT * FROM story WHERE kind = 'functional' AND state = 'backlog' ORDER BY id",
  )
  const updatePoints = db.prepare<[number, number]>(
    "UPDATE story SET points = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const updateRollout = db.prepare<[number, number]>(
    "UPDATE story SET rollout_percent = ?, state = 'flagged', updated_at = datetime('now') WHERE id = ?",
  )
  const updateMergeConflict = db.prepare<[number, number]>(
    "UPDATE story SET merge_conflict = ?, updated_at = datetime('now') WHERE id = ?",
  )

  function findStory(storyId: number): Story {
    const row = selectStory.get(storyId)
    if (row === undefined) {
      throw new StoryNotFoundError(storyId)
    }
    return toStory(row)
  }

  function nextReference(epicId: number): string {
    const project = selectProjectSlug.get(epicId)
    if (project === undefined) {
      throw new StoryNotFoundError(epicId)
    }
    const written = countFunctionalStories.get(epicId)?.total ?? 0
    return `${project.slug.toUpperCase()}-${written + 1}`
  }

  function moveTo(storyId: number, state: StoryState): Story {
    updateState.run(state, storyId)
    return findStory(storyId)
  }

  return {
    createProject: (draft) => {
      const info = insertProject.run(
        draft.slug,
        draft.name,
        draft.repositoryUrl,
        draft.integrationBranch,
        draft.colour,
      )
      return { id: Number(info.lastInsertRowid), ...draft }
    },

    createEpic: (draft) => {
      const info = insertEpic.run(draft.projectId, draft.title, draft.businessIntent)
      return { id: Number(info.lastInsertRowid), ...draft }
    },

    writeStory: (draft) => {
      const info = insertStory.run(draft.epicId, null, nextReference(draft.epicId), draft.title, draft.body, 'functional')
      return findStory(Number(info.lastInsertRowid))
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

    sendToBacklog: (storyId) => {
      const story = findStory(storyId)
      const twin = selectTwin.get(story.id)
      if (story.kind === 'functional' && twin === undefined) {
        throw new TwinRequiredError(story.reference)
      }
      if (twin !== undefined) {
        moveTo(twin.id, 'backlog')
      }
      return moveTo(story.id, 'backlog')
    },

    addDependency: (dependency) => {
      const blocked = findStory(dependency.blockedStoryId)
      if (dependency.blockedStoryId === dependency.blockingStoryId) {
        throw new SelfDependencyError(blocked.reference)
      }
      findStory(dependency.blockingStoryId)
      insertDependency.run(dependency.blockedStoryId, dependency.blockingStoryId)
    },

    startBuilding: (storyId) => {
      const story = findStory(storyId)
      const blockers = selectUnresolvedBlockers.all(story.id).map((blocker) => blocker.reference)
      if (blockers.length > 0) {
        throw new BlockedByDependencyError(story.reference, blockers)
      }
      return moveTo(story.id, 'building')
    },

    markDone: (storyId) => moveTo(storyId, 'done'),

    listBacklog: () => selectBacklog.all().map(toStory),

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
      return findStory(story.id)
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
  }
}
