import { describe, expect, it, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { seedDemoBoard } from '../../../src/technical/Seed/DemoSeed.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createStatisticRepository } from '../../../src/domain/Statistic/StatisticRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { KANBAN_COLUMNS } from '../../../src/domain/Story/Story.js'

const CENSUS = { tests: 0, skipped: 0, tautologies: 0 }

let db: Database.Database

beforeEach(() => {
  db = openDatabase(':memory:')
  seedDemoBoard(db)
})

describe('seedDemoBoard', () => {
  it('gives the board several projects, so the cards differ in colour', () => {
    expect(createStoryRepository(db).listProjects().length).toBeGreaterThan(1)
  })

  it('fills every kanban column, so no column is drawn empty', () => {
    const kanban = createStoryRepository(db).listKanban()

    for (const column of KANBAN_COLUMNS) {
      expect(kanban.filter((story) => story.state === column.key).length).toBeGreaterThan(0)
    }
  })

  it('leaves stories in the backlog too', () => {
    expect(createStoryRepository(db).listBacklog().length).toBeGreaterThan(0)
  })

  it('pairs every functional story with its twin', () => {
    const stories = createStoryRepository(db)
    const functional = db
      .prepare("SELECT id FROM story WHERE kind = 'functional'")
      .all() as readonly { id: number }[]

    for (const story of functional) {
      expect(stories.findTwin(story.id)).not.toBeNull()
    }
  })

  it('proves a whole definition of done on at least one story', () => {
    const checkpoints = createCheckpointRepository(db, { takeCensus: () => CENSUS })
    const kanban = createStoryRepository(db).listKanban()
    const complete = kanban.filter((story) =>
      checkpoints.definitionOfDone(story.id).every((step) => step.proven),
    )

    expect(complete.length).toBeGreaterThan(0)
  })

  it('leaves a definition of done half proven, so the progress bar is not always full', () => {
    const checkpoints = createCheckpointRepository(db, { takeCensus: () => CENSUS })
    const kanban = createStoryRepository(db).listKanban()
    const partial = kanban.filter((story) => {
      const steps = checkpoints.definitionOfDone(story.id)
      return steps.some((step) => step.proven) && steps.some((step) => !step.proven)
    })

    expect(partial.length).toBeGreaterThan(0)
  })

  it('shows a review cascade caught mid-flight', () => {
    const checkpoints = createCheckpointRepository(db, { takeCensus: () => CENSUS })
    const kanban = createStoryRepository(db).listKanban()
    const running = kanban.filter((story) =>
      checkpoints.reviewCascade(story.id).some((pass) => pass.state === 'running'),
    )

    expect(running.length).toBeGreaterThan(0)
  })

  it('names the lens agent that is actually reading, not the previous one', () => {
    const checkpoints = createCheckpointRepository(db, { takeCensus: () => CENSUS })
    const kanban = createStoryRepository(db).listKanban()
    const running = kanban.flatMap((story) =>
      checkpoints.reviewCascade(story.id).filter((pass) => pass.state === 'running'),
    )

    expect(running.length).toBeGreaterThan(0)
    for (const pass of running) {
      expect(pass.agentName).toBe({ quality: 'elrond', security: 'seraph', accessibility: 'link' }[pass.lens])
    }
  })

  it('leaves an unresolved finding to read', () => {
    const checkpoints = createCheckpointRepository(db, { takeCensus: () => CENSUS })
    const kanban = createStoryRepository(db).listKanban()
    const flagged = kanban.filter((story) => checkpoints.listUnresolvedFindings(story.id).length > 0)

    expect(flagged.length).toBeGreaterThan(0)
  })

  it('declares acceptance criteria, some met and some not', () => {
    const criteria = createCriterionRepository(db)
    const stories = createStoryRepository(db).listKanban()
    const all = stories.flatMap((story) => criteria.listCriteria(story.id))

    expect(all.some((criterion) => criterion.satisfied)).toBe(true)
    expect(all.some((criterion) => !criterion.satisfied)).toBe(true)
  })

  it('writes a digest on every zone it declares', () => {
    const zones = createZoneRepository(db)
    const projects = createStoryRepository(db).listProjects()
    const declared = projects.flatMap((project) => zones.listZones(project.id))

    expect(declared.length).toBeGreaterThan(0)
    for (const zone of declared) {
      expect(zone.summary).not.toBeNull()
    }
  })

  it('colours the zone files by the story that touched them', () => {
    const zones = createZoneRepository(db)
    const projects = createStoryRepository(db).listProjects()
    const files = projects.flatMap((project) =>
      zones.overview(project.id).flatMap((overview) => overview.files),
    )

    expect(files.length).toBeGreaterThan(0)
    expect(new Set(files.map((file) => file.storyReference)).size).toBeGreaterThan(1)
  })

  it('leaves a story blocked by another, so a dependency link is drawn', () => {
    const stories = createStoryRepository(db)
    const blocked = stories.listKanban().filter((story) => stories.listBlockers(story.id).length > 0)

    expect(blocked.length).toBeGreaterThan(0)
  })

  it('marks a merge conflict, so the alert shows on a card', () => {
    expect(createStoryRepository(db).listKanban().some((story) => story.mergeConflict)).toBe(true)
  })

  it('escalates one story with a reason to read', () => {
    const escalated = createStoryRepository(db)
      .listKanban()
      .filter((story) => story.escalationReason !== null)

    expect(escalated.length).toBeGreaterThan(0)
  })

  it('gives the statistics screen a history spread over several days', () => {
    const history = createStatisticRepository(db).listHistory()

    expect(history.length).toBeGreaterThan(5)
    expect(new Set(history.map((entry) => entry.startedAt.slice(0, 10))).size).toBeGreaterThan(1)
  })

  it('records more than one kind of outcome, so the failures are visible', () => {
    const outcomes = createStatisticRepository(db)
      .listHistory()
      .map((entry) => entry.outcome)

    expect(new Set(outcomes).size).toBeGreaterThan(1)
  })

  it('spends something, so the cost is not flat zero', () => {
    expect(createStatisticRepository(db).summarise().totalCostUsd).toBeGreaterThan(0)
  })

  it('reserves a scope for more than one story, so the perimeters are readable', () => {
    const foremerge = createForemergeRepository(db, { stories: createStoryRepository(db) })

    expect(foremerge.listReservations().length).toBeGreaterThan(1)
  })

  it('opens worktrees, so the resource screen is not empty', () => {
    const live = db.prepare('SELECT COUNT(*) AS total FROM worktree').get() as { total: number }

    expect(live.total).toBeGreaterThan(0)
  })

  it('leaves a finished parcours with its acts, so the pilot panel has a history', () => {
    const acts = db.prepare('SELECT COUNT(*) AS total FROM pilot_act').get() as { total: number }

    expect(acts.total).toBeGreaterThan(0)
  })

  it('can be run twice without piling up a second board', () => {
    const before = createStoryRepository(db).listKanban().length

    seedDemoBoard(db)

    expect(createStoryRepository(db).listKanban().length).toBe(before)
  })
})

describe('the epics the seed leaves on the story screen', () => {
  it('leaves some epics free to be picked up', () => {
    expect(
      db
        .prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM epic WHERE assignee IS NULL')
        .get()?.total ?? 0,
    ).toBeGreaterThan(1)
  })

  it('puts some epics under the local operator', () => {
    expect(
      db
        .prepare<[string], { total: number }>(
          'SELECT COUNT(*) AS total FROM epic WHERE assignee = ?',
        )
        .get('local')?.total ?? 0,
    ).toBeGreaterThan(1)
  })

  it('puts at least one epic under someone else, so the filter proves something', () => {
    expect(
      db
        .prepare<[string], { total: number }>(
          "SELECT COUNT(*) AS total FROM epic WHERE assignee IS NOT NULL AND assignee != ?",
        )
        .get('local')?.total ?? 0,
    ).toBeGreaterThan(0)
  })

  it('gives more than one epic to a project, so the project filter proves something', () => {
    const most =
      db
        .prepare<[], { total: number }>(
          'SELECT COUNT(*) AS total FROM epic GROUP BY project_id ORDER BY total DESC LIMIT 1',
        )
        .get()?.total ?? 0
    expect(most).toBeGreaterThan(1)
  })

  it('leaves the spare epics without any story, they are subjects to pick up', () => {
    const bare =
      db
        .prepare<[], { total: number }>(
          'SELECT COUNT(*) AS total FROM epic WHERE id NOT IN (SELECT epic_id FROM story)',
        )
        .get()?.total ?? 0
    expect(bare).toBe(5)
  })
})
