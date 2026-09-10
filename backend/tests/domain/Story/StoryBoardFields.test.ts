import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KANBAN_COLUMNS, columnOfState } from '../../../src/domain/Story/Story.js'
import type { StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  PointsOutOfRangeError,
  RolloutOutOfRangeError,
} from '../../../src/domain/Story/StoryViolation.js'
import { openDatabase } from '../../../src/technical/Database/Connection.js'

describe('story board fields', () => {
  let home: string
  let db: Database.Database
  let repository: StoryRepository
  let storyId: number

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'forge-board-'))
    db = openDatabase(join(home, 'forge.db'))
    repository = createStoryRepository(db)
    const project = repository.createProject({
      slug: 'ps',
      name: 'Panier & Search',
      repositoryUrl: 'git@example.com:ps.git',
      integrationBranch: 'main',
      colour: '#8B5CFF',
    })
    const epic = repository.createEpic({
      projectId: project.id,
      title: 'Panier',
      businessIntent: 'Retrouver son panier partout',
    })
    storyId = repository.writeStory({
      epicId: epic.id,
      title: 'Panier persistant multi-device',
      body: 'Le panier survit au changement de device',
    }).id
  })

  afterEach(() => {
    db.close()
    rmSync(home, { recursive: true, force: true })
  })

  it('writes a story with no estimate and no rollout', () => {
    const story = repository.findStory(storyId)
    expect(story.points).toBeNull()
    expect(story.rolloutPercent).toBeNull()
    expect(story.mergeConflict).toBe(false)
  })

  it('records an estimate in points', () => {
    expect(repository.estimate(storyId, 5).points).toBe(5)
  })

  it('refuses an estimate that is not a positive whole number', () => {
    expect(() => repository.estimate(storyId, 0)).toThrow(PointsOutOfRangeError)
    expect(() => repository.estimate(storyId, 2.5)).toThrow(PointsOutOfRangeError)
  })

  it('exposes a story under a feature flag with its share of users', () => {
    const story = repository.rollOut(storyId, 25)
    expect(story.state).toBe('flagged')
    expect(story.rolloutPercent).toBe(25)
  })

  it('refuses a share of users outside nought to a hundred', () => {
    expect(() => repository.rollOut(storyId, 140)).toThrow(RolloutOutOfRangeError)
  })

  it('flags and clears a merge conflict on the card', () => {
    expect(repository.markMergeConflict(storyId).mergeConflict).toBe(true)
    expect(repository.clearMergeConflict(storyId).mergeConflict).toBe(false)
  })
})

describe('kanban columns', () => {
  it('runs from the plan to production', () => {
    expect(KANBAN_COLUMNS.map((column) => column.key)).toEqual([
      'architecture',
      'plan_review',
      'building',
      'gating',
      'reviewing',
      'shipping',
      'flagged',
      'done',
    ])
  })

  it('carries the planning as its first two columns', () => {
    expect(columnOfState('architecture')).toBe('architecture')
    expect(columnOfState('plan_review')).toBe('plan_review')
  })

  it('places every board state in exactly one column', () => {
    expect(columnOfState('building')).toBe('building')
    expect(columnOfState('drafting')).toBeNull()
    expect(columnOfState('backlog')).toBeNull()
  })
})
