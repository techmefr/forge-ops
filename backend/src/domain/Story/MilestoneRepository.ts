import type Database from 'better-sqlite3'
import { DEADLINE_KINDS, type Milestone, type MilestoneKind } from '../../../../contract/StoryContract.js'
import { EpicNotFoundError } from './StoryViolation.js'

export type CardContext = {
  storyId: number
  projectSlug: string
  projectColour: string
  epicTitle: string
  holder: string | null
  milestones: readonly Milestone[]
}

export type MilestoneRepository = {
  listCardContexts: () => readonly CardContext[]
  writeMilestone: (milestone: Milestone) => Milestone
  listMilestones: (epicId: number) => readonly Milestone[]
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

export function createMilestoneRepository(db: Database.Database): MilestoneRepository {
  const selectEpicProject = db.prepare<[number], { project_id: number }>(
    'SELECT project_id FROM epic WHERE id = ?',
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

  return {
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
      const epic = selectEpicProject.get(milestone.epicId)
      if (epic === undefined) {
        throw new EpicNotFoundError(milestone.epicId)
      }
      const moved = moveMilestone.run(milestone.dueOn, milestone.epicId, milestone.kind)
      if (moved.changes === 0) {
        insertMilestone.run(milestone.epicId, epic.project_id, milestone.kind, milestone.dueOn)
      }
      return milestone
    },

    listMilestones: (epicId) => selectMilestones.all(epicId).map(toMilestone),
  }
}
