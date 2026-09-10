import type Database from 'better-sqlite3'
import type {
  Dependency,
  Epic,
  EpicDraft,
  EpicOverview,
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
  DependencyCycleError,
  EpicNotFoundError,
  EpicTakenError,
  SelfDependencyError,
  ProjectNotFoundError,
  ProjectSlugTakenError,
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
  listProjects: () => readonly Project[]
  createEpic: (draft: EpicDraft) => Epic
  listEpics: (projectId: number) => readonly EpicOverview[]
  claimEpic: (epicId: number, login: string) => void
  releaseEpic: (epicId: number, login: string) => void
  writeStory: (draft: StoryDraft) => Story
  writeTwin: (draft: TwinDraft) => Story
  findStory: (storyId: number) => Story
  findTwin: (storyId: number) => Story | null
  sendToBacklog: (storyId: number) => Story
  addDependency: (dependency: Dependency) => void
  listBlockers: (storyId: number) => readonly string[]
  markDoneAndUnblock: (storyId: number) => readonly Story[]
  startBuilding: (storyId: number) => Story
  moveToState: (storyId: number, state: StoryState) => Story
  markDone: (storyId: number) => Story
  listBacklog: () => readonly Story[]
  listKanban: () => readonly Story[]
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
  const selectProjects = db.prepare<
    [],
    {
      id: number
      slug: string
      name: string
      repository_url: string
      integration_branch: string
      colour: string
    }
  >('SELECT * FROM project ORDER BY name')
  const selectEpics = db.prepare<
    [number],
    {
      id: number
      project_id: number
      title: string
      business_intent: string
      assignee: string | null
      story_count: number
    }
  >(
    `SELECT epic.id, epic.project_id, epic.title, epic.business_intent, epic.assignee,
            COUNT(story.id) AS story_count
       FROM epic
       LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
      WHERE epic.project_id = ?
      GROUP BY epic.id
      ORDER BY epic.id`,
  )
  const selectEpicById = db.prepare<[number], { id: number; assignee: string | null }>(
    'SELECT id, assignee FROM epic WHERE id = ?',
  )
  const updateEpicAssignee = db.prepare<[string | null, number]>(
    'UPDATE epic SET assignee = ? WHERE id = ?',
  )
  const selectProjectById = db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const selectProjectBySlug = db.prepare<[string], { id: number }>('SELECT id FROM project WHERE slug = ?')
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
    'INSERT OR IGNORE INTO story_dependency (blocked_story_id, blocking_story_id) VALUES (?, ?)',
  )
  const selectBlockingOf = db.prepare<[number], { blocking_story_id: number }>(
    'SELECT blocking_story_id FROM story_dependency WHERE blocked_story_id = ?',
  )
  const selectBlockedBy = db.prepare<[number], { blocked_story_id: number }>(
    'SELECT blocked_story_id FROM story_dependency WHERE blocking_story_id = ?',
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
  const selectKanban = db.prepare<[], StoryRow>(
    `SELECT * FROM story
      WHERE kind = 'functional' AND state NOT IN ('drafting', 'backlog')
      ORDER BY id`,
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

  function findTwin(storyId: number): Story | null {
    const row = selectTwin.get(storyId)
    return row === undefined ? null : toStory(row)
  }

  function nextReference(epicId: number): string {
    const project = selectProjectSlug.get(epicId)
    if (project === undefined) {
      throw new StoryNotFoundError(epicId)
    }
    const written = countFunctionalStories.get(epicId)?.total ?? 0
    return `${project.slug.toUpperCase()}-${written + 1}`
  }

  function pathToward(fromStoryId: number, targetStoryId: number): number[] | null {
    const seen = new Set<number>()
    const walk = (current: number, trail: number[]): number[] | null => {
      if (current === targetStoryId) {
        return trail
      }
      if (seen.has(current)) {
        return null
      }
      seen.add(current)
      for (const row of selectBlockingOf.all(current)) {
        const found = walk(row.blocking_story_id, [...trail, row.blocking_story_id])
        if (found !== null) {
          return found
        }
      }
      return null
    }
    return walk(fromStoryId, [])
  }

  function moveTo(storyId: number, state: StoryState): Story {
    updateState.run(state, storyId)
    return findStory(storyId)
  }

  return {
    createProject: (draft) => {
      if (selectProjectBySlug.get(draft.slug) !== undefined) {
        throw new ProjectSlugTakenError(draft.slug)
      }
      const info = insertProject.run(
        draft.slug,
        draft.name,
        draft.repositoryUrl,
        draft.integrationBranch,
        draft.colour,
      )
      return { id: Number(info.lastInsertRowid), ...draft }
    },

    listProjects: () =>
      selectProjects.all().map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        repositoryUrl: row.repository_url,
        integrationBranch: row.integration_branch,
        colour: row.colour,
      })),

    createEpic: (draft) => {
      if (selectProjectById.get(draft.projectId) === undefined) {
        throw new ProjectNotFoundError(draft.projectId)
      }
      const info = insertEpic.run(draft.projectId, draft.title, draft.businessIntent)
      return { id: Number(info.lastInsertRowid), ...draft }
    },

    listEpics: (projectId) =>
      selectEpics.all(projectId).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        businessIntent: row.business_intent,
        assignee: row.assignee,
        storyCount: row.story_count,
      })),

    claimEpic: (epicId, login) => {
      const epic = selectEpicById.get(epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      if (epic.assignee !== null && epic.assignee !== login) {
        throw new EpicTakenError(epicId, epic.assignee)
      }
      updateEpicAssignee.run(login, epicId)
    },

    releaseEpic: (epicId, login) => {
      const epic = selectEpicById.get(epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      if (epic.assignee !== null && epic.assignee !== login) {
        throw new EpicTakenError(epicId, epic.assignee)
      }
      updateEpicAssignee.run(null, epicId)
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
      return moveTo(story.id, 'backlog')
    },

    addDependency: (dependency) => {
      const blocked = findStory(dependency.blockedStoryId)
      if (dependency.blockedStoryId === dependency.blockingStoryId) {
        throw new SelfDependencyError(blocked.reference)
      }
      const blocking = findStory(dependency.blockingStoryId)
      const loop = pathToward(dependency.blockingStoryId, dependency.blockedStoryId)
      if (loop !== null) {
        throw new DependencyCycleError(
          blocking.reference,
          loop.map((storyId) => findStory(storyId).reference),
        )
      }
      insertDependency.run(dependency.blockedStoryId, dependency.blockingStoryId)
    },

    listBlockers: (storyId) => selectUnresolvedBlockers.all(storyId).map((row) => row.reference),

    markDoneAndUnblock: (storyId) => {
      moveTo(storyId, 'done')
      const freed: Story[] = []
      for (const row of selectBlockedBy.all(storyId)) {
        if (selectUnresolvedBlockers.all(row.blocked_story_id).length === 0) {
          freed.push(findStory(row.blocked_story_id))
        }
      }
      return freed
    },

    startBuilding: (storyId) => {
      const story = findStory(storyId)
      const blockers = selectUnresolvedBlockers.all(story.id).map((blocker) => blocker.reference)
      if (blockers.length > 0) {
        throw new BlockedByDependencyError(story.reference, blockers)
      }
      return moveTo(story.id, 'building')
    },

    moveToState: (storyId, state) => moveTo(findStory(storyId).id, state),

    markDone: (storyId) => moveTo(storyId, 'done'),

    listBacklog: () => selectBacklog.all().map(toStory),

    listKanban: () => selectKanban.all().map(toStory),

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
