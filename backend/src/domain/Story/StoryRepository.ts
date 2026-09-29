import type Database from 'better-sqlite3'
import type { EpicQuery } from '../../../../contract/EpicContract.js'
import { matchesQuery } from '../../../../contract/SubjectQuery.js'
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
import { DEADLINE_KINDS, type Milestone, type MilestoneKind } from '../../../../contract/StoryContract.js'
import {
  BlockedByDependencyError,
  PointsOutOfRangeError,
  RolloutOutOfRangeError,
  DependencyCycleError,
  EmptyBlockedReasonError,
  EmptyCardError,
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
import type { HumanGateWait } from './HumanGate.js'
import { HUMAN_GATE_STATES } from './HumanGate.js'
import type { StepBackDraft, StepBackRecord } from './StepBack.js'
import type { CheckpointName } from '../Checkpoint/Checkpoint.js'
import { assertCheckoutPath } from './CheckoutPath.js'
import { createEpicRepository, type EpicRepository, type OverviewOptions } from '../Epic/EpicRepository.js'
import { createEventRepository, type EventRepository } from '../Event/EventRepository.js'
import { createProjectRepository, type ProjectRepository } from '../Project/ProjectRepository.js'
import { InactiveAssigneeError } from '../Epic/EpicViolation.js'
import { createFollowUpRepository, type FollowUpRepository } from '../FollowUp/FollowUpRepository.js'

type StepBackRow = {
  id: number
  story_id: number
  from_state: StoryState
  to_state: StoryState
  reason: string
  asked_by: string
  revoked_checkpoints: string
  stepped_back_at: string
}

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
  blocked_reason: string | null
}

export type StoryRepository = {
  createProject: (draft: ProjectDraft) => Project
  listProjects: () => readonly Project[]
  setCheckoutPath: (projectId: number, checkoutPath: string) => Project
  createEpic: (draft: EpicDraft) => Epic
  epics: EpicRepository
  agenda: EventRepository
  projects: ProjectRepository
  followUps: FollowUpRepository
  listEpics: (projectId: number, options?: OverviewOptions) => readonly EpicOverview[]
  listEveryEpic: (query: EpicQuery, today: string) => readonly EpicOverview[]
  assigneeOf: (epicId: number) => string | null
  findEpic: (epicId: number) => Epic
  listHumanGateWaits: () => readonly HumanGateWait[]
  projectOfStory: (storyId: number) => number
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
  setPlacement: (storyId: number, placement: StoryPlacement) => Story
  stepBack: (draft: StepBackDraft) => StepBackRecord
  listStepBacks: (storyId: number) => readonly StepBackRecord[]
  listBacklog: () => readonly Story[]
  listKanban: () => readonly Story[]
  listCardContexts: () => readonly CardContext[]
  writeMilestone: (milestone: Milestone) => Milestone
  listMilestones: (epicId: number) => readonly Milestone[]
  editStory: (storyId: number, draft: { title: string; body: string }) => Story
  estimate: (storyId: number, points: number) => Story
  rollOut: (storyId: number, percent: number) => Story
  markMergeConflict: (storyId: number) => Story
  clearMergeConflict: (storyId: number) => Story
  blockStory: (storyId: number, reason: string) => Story
  unblockStory: (storyId: number) => Story
}

function toStepBack(row: StepBackRow): StepBackRecord {
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

export type StoryPlacement = {
  state: StoryState
  workflowColumnId: number | null
}

export type CardContext = {
  storyId: number
  projectSlug: string
  projectColour: string
  epicTitle: string
  holder: string | null
  milestones: readonly Milestone[]
}

type CardContextRow = {
  story_id: number
  project_slug: string
  project_colour: string
  epic_id: number
  epic_title: string
  holder: string | null
}

type MilestoneRow = {
  epic_id: number
  kind: MilestoneKind
  due_on: string
}

const DEADLINE_LIST = `(${DEADLINE_KINDS.map((kind) => `'${kind}'`).join(', ')})`

function toMilestone(row: MilestoneRow): Milestone {
  return { epicId: row.epic_id, kind: row.kind, dueOn: row.due_on }
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
    blockedReason: row.blocked_reason,
  }
}

export type StoryRepositoryOptions = {
  checkoutRoots?: readonly string[]
  now?: () => string
}

export function createStoryRepository(
  db: Database.Database,
  { checkoutRoots = [process.cwd()], now }: StoryRepositoryOptions = {},
): StoryRepository {
  const epics = createEpicRepository(db, { now })
  const agenda = createEventRepository(db, { now })
  const projects = createProjectRepository(db, { epics })
  const followUps = createFollowUpRepository(db, { epics, agenda })
  const insertProject = db.prepare<[string, string, string, string, string, string | null]>(
    'INSERT INTO project (slug, name, repository_url, integration_branch, colour, checkout_path, position) VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM project))',
  )
  const updateCheckoutPath = db.prepare<[string, number]>(
    'UPDATE project SET checkout_path = ? WHERE id = ?',
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
      checkout_path: string | null
    }
  >('SELECT * FROM project ORDER BY position, name')
  const selectEpics = db.prepare<
    [number, number],
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
      WHERE epic.project_id = ? AND (epic.deleted_at IS NOT NULL) = ?
      GROUP BY epic.id
      ORDER BY epic.id`,
  )
  const selectEpicById = db.prepare<[number], { id: number; project_id: number; assignee: string | null }>(
    'SELECT id, project_id, assignee FROM epic WHERE id = ?',
  )
  const updateEpicAssignee = db.prepare<[string | null, number]>(
    'UPDATE epic SET assignee = ? WHERE id = ?',
  )
  const selectDisabledAt = db.prepare<[string], { disabled_at: string | null }>(
    'SELECT disabled_at FROM board_user WHERE login = ?',
  )
  const selectProjectById =db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const selectProjectBySlug = db.prepare<[string], { id: number }>('SELECT id FROM project WHERE slug = ?')
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
  const updateState = db.prepare<[StoryState, StoryState, number]>(
    `UPDATE story
        SET state = ?,
            workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                JOIN epic ON epic.project_id = workflow_column.project_id
               WHERE epic.id = story.epic_id AND workflow_column.key = ?
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
  const selectCardContexts = db.prepare<[], CardContextRow>(
    `SELECT story.id AS story_id,
            project.slug AS project_slug,
            project.colour AS project_colour,
            epic.id AS epic_id,
            epic.title AS epic_title,
            epic.assignee AS holder
       FROM story
       JOIN epic ON epic.id = story.epic_id
       JOIN project ON project.id = epic.project_id
      ORDER BY story.id`,
  )
  const selectMilestones = db.prepare<[number], MilestoneRow>(
    `SELECT epic_id, kind, due_on FROM epic_milestone WHERE epic_id = ? AND kind IN ${DEADLINE_LIST} ORDER BY due_on`,
  )
  const selectEveryMilestone = db.prepare<[], MilestoneRow>(
    `SELECT epic_id, kind, due_on FROM epic_milestone WHERE epic_id IS NOT NULL AND kind IN ${DEADLINE_LIST} ORDER BY epic_id, due_on`,
  )
  const moveMilestone = db.prepare<[string, number, MilestoneKind]>(
    'UPDATE epic_milestone SET due_on = ? WHERE epic_id = ? AND kind = ?',
  )
  const insertMilestone = db.prepare<[number, number, MilestoneKind, string]>(
    'INSERT INTO epic_milestone (epic_id, project_id, kind, due_on) VALUES (?, ?, ?, ?)',
  )
  const selectKanban = db.prepare<[], StoryRow>(
    `SELECT * FROM story
      WHERE kind = 'functional' AND state <> 'drafting'
      ORDER BY id`,
  )
  const updateCard = db.prepare<[string, string, number]>(
    'UPDATE story SET title = ?, body = ? WHERE id = ?',
  )
  const updatePoints = db.prepare<[number, number]>(
    "UPDATE story SET points = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const updateRollout = db.prepare<[number, number]>(
    "UPDATE story SET rollout_percent = ?, state = 'flagged', updated_at = datetime('now') WHERE id = ?",
  )
  const insertStepBack = db.prepare<[number, StoryState, StoryState, string, string, string]>(
    `INSERT INTO story_step_back (story_id, from_state, to_state, reason, asked_by, revoked_checkpoints)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const selectStepBack = db.prepare<[number], StepBackRow>(
    'SELECT * FROM story_step_back WHERE id = ?',
  )
  const selectStepBacks = db.prepare<[number], StepBackRow>(
    'SELECT * FROM story_step_back WHERE story_id = ? ORDER BY id',
  )
  const updateMergeConflict = db.prepare<[number, number]>(
    "UPDATE story SET merge_conflict = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const updateBlockedReason = db.prepare<[string | null, number]>(
    "UPDATE story SET blocked_reason = ?, updated_at = datetime('now') WHERE id = ?",
  )
  const selectFullEpic = db.prepare<
    [number],
    { id: number; project_id: number; title: string; business_intent: string }
  >('SELECT id, project_id, title, business_intent FROM epic WHERE id = ?')
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

  function settle(story: Story): Story {
    epics.recordState(story.epicId)
    return story
  }

  function moveTo(storyId: number, state: StoryState): Story {
    updateState.run(state, state, storyId)
    return settle(findStory(storyId))
  }

  function epicsOfProject(projectId: number, options: OverviewOptions = {}): readonly EpicOverview[] {
    const planning = epics.planningOf(projectId, options)
    return selectEpics.all(projectId, options.deleted === true ? 1 : 0).flatMap((row) => {
      const planned = planning.get(row.id)
      return planned === undefined
        ? []
        : [
            {
              id: row.id,
              projectId: row.project_id,
              title: row.title,
              businessIntent: row.business_intent,
              assignee: row.assignee,
              storyCount: row.story_count,
              ...planned,
            },
          ]
    })
  }

  function allProjects(): readonly Project[] {
    return selectProjects.all().map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      repositoryUrl: row.repository_url,
      integrationBranch: row.integration_branch,
      colour: row.colour,
      checkoutPath: row.checkout_path,
    }))
  }

  return {
    createProject: (draft) => {
      if (selectProjectBySlug.get(draft.slug) !== undefined) {
        throw new ProjectSlugTakenError(draft.slug)
      }
      const checkoutPath =
        draft.checkoutPath === undefined || draft.checkoutPath === null
          ? null
          : assertCheckoutPath(draft.checkoutPath, checkoutRoots)
      const info = insertProject.run(
        draft.slug,
        draft.name,
        draft.repositoryUrl,
        draft.integrationBranch,
        draft.colour,
        checkoutPath,
      )
      return { id: Number(info.lastInsertRowid), ...draft, checkoutPath }
    },

    listProjects: allProjects,

    setCheckoutPath: (projectId, checkoutPath) => {
      if (selectProjectById.get(projectId) === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      updateCheckoutPath.run(assertCheckoutPath(checkoutPath, checkoutRoots), projectId)
      const found = allProjects().find((project) => project.id === projectId)
      if (found === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      return found
    },

    createEpic: (draft) => {
      if (selectProjectById.get(draft.projectId) === undefined) {
        throw new ProjectNotFoundError(draft.projectId)
      }
      const info = insertEpic.run(draft.projectId, draft.title, draft.businessIntent)
      const id = Number(info.lastInsertRowid)
      epics.recordState(id)
      return { id, ...draft }
    },

    epics,
    projects,

    agenda,

    followUps,

    listEveryEpic: (query, today) =>
      allProjects()
        .flatMap((project) => epicsOfProject(project.id, { today, deleted: query.state === 'trash' }))
        .filter((epic) => matchesQuery(epic, query)),

    listEpics: epicsOfProject,

    projectOfStory: (storyId) => {
      const row = selectProjectOfStory.get(storyId)
      if (row === undefined) {
        throw new StoryNotFoundError(storyId)
      }
      return row.project_id
    },

    assigneeOf: (epicId) => {
      const epic = selectEpicById.get(epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return epic.assignee
    },

    findEpic: (epicId) => {
      const row = selectFullEpic.get(epicId)
      if (row === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      return {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        businessIntent: row.business_intent,
      }
    },

    listHumanGateWaits: () =>
      selectHumanGateWaits.all(...HUMAN_GATE_STATES).map((row) => ({
        storyId: row.id,
        reference: row.reference,
        state: row.state,
        waitingSince: row.updated_at,
        waitingSeconds: row.waiting_seconds,
      })),

    claimEpic: (epicId, login) => {
      const epic = selectEpicById.get(epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(epicId)
      }
      if (epic.assignee !== null && epic.assignee !== login) {
        throw new EpicTakenError(epicId, epic.assignee)
      }
      const deactivatedAt = selectDisabledAt.get(login)?.disabled_at ?? null
      if (deactivatedAt !== null) {
        throw new InactiveAssigneeError(login)
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

    setPlacement: (storyId, placement) => {
      const story = findStory(storyId)
      updatePlacement.run(placement.state, placement.workflowColumnId, story.id)
      return findStory(story.id)
    },

    stepBack: (draft) => {
      const story = findStory(draft.storyId)
      const info = insertStepBack.run(
        story.id,
        story.state,
        draft.toState,
        draft.reason,
        draft.askedBy,
        draft.revokedCheckpoints.join(','),
      )
      moveTo(story.id, draft.toState)
      const row = selectStepBack.get(Number(info.lastInsertRowid))
      if (row === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      return toStepBack(row)
    },

    listStepBacks: (storyId) => selectStepBacks.all(storyId).map(toStepBack),

    listBacklog: () => selectBacklog.all().map(toStory),

    listKanban: () => selectKanban.all().map(toStory),

    listCardContexts: () => {
      const dated = new Map<number, Milestone[]>()
      for (const row of selectEveryMilestone.all()) {
        dated.set(row.epic_id, [...(dated.get(row.epic_id) ?? []), toMilestone(row)])
      }
      return selectCardContexts.all().map((row) => ({
        storyId: row.story_id,
        projectSlug: row.project_slug,
        projectColour: row.project_colour,
        epicTitle: row.epic_title,
        holder: row.holder,
        milestones: dated.get(row.epic_id) ?? [],
      }))
    },

    writeMilestone: (milestone) => {
      if (selectEpicById.get(milestone.epicId) === undefined) {
        throw new EpicNotFoundError(milestone.epicId)
      }
      const moved = moveMilestone.run(milestone.dueOn, milestone.epicId, milestone.kind)
      if (moved.changes === 0) {
        const epic = selectEpicById.get(milestone.epicId)
        insertMilestone.run(milestone.epicId, epic?.project_id ?? 0, milestone.kind, milestone.dueOn)
      }
      return milestone
    },

    listMilestones: (epicId) => selectMilestones.all(epicId).map(toMilestone),

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
