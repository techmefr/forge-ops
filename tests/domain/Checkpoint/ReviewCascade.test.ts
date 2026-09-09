import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { REVIEW_LENS_SEQUENCE } from '../../../src/domain/Checkpoint/Checkpoint.js'
import type { CheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import {
  LensOutOfOrderError,
  ReviewIncompleteError,
} from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { openDatabase } from '../../../src/technical/Database/Connection.js'

const EARLIER_STEPS = ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified'] as const

describe('review cascade', () => {
  let home: string
  let db: Database.Database
  let checkpoints: CheckpointRepository
  let sessions: AgentSessionRepository
  let storyId: number

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'forge-cascade-'))
    db = openDatabase(join(home, 'forge.db'))
    const stories = createStoryRepository(db)
    checkpoints = createCheckpointRepository(db)
    sessions = createAgentSessionRepository(db)
    const project = stories.createProject({
      slug: 'ps',
      name: 'Panier',
      repositoryUrl: 'git@example.com:ps.git',
      integrationBranch: 'main',
      colour: '#8B5CFF',
    })
    const epic = stories.createEpic({
      projectId: project.id,
      title: 'Panier',
      businessIntent: 'Retrouver son panier',
    })
    const story = stories.writeStory({ epicId: epic.id, title: 'Panier persistant', body: 'corps' })
    stories.writeTwin({ storyId: story.id, title: 'Test — panier persistant', body: 'corps' })
    storyId = story.id
    const criteria = createCriterionRepository(db)
    const criterion = criteria.declareCriterion({
      storyId,
      reference: 'AC-1',
      statement: 'le panier survit a la deconnexion',
    })
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/PS-1/tests.md')
    for (const name of EARLIER_STEPS) {
      checkpoints.proveCheckpoint({ storyId, name, evidencePath: `.claude/evidence/PS-1/${name}.md` })
    }
  })

  afterEach(() => {
    db.close()
    rmSync(home, { recursive: true, force: true })
  })

  function openSession(agentName: string): string {
    const claudeSessionId = `session-${agentName}`
    sessions.registerSession({
      storyId,
      claudeSessionId,
      phase: 'review',
      agentName,
      claudeCodeVersion: '2.1.224',
    })
    return claudeSessionId
  }

  it('starts every story with the three lenses pending', () => {
    const passes = checkpoints.reviewCascade(storyId)
    expect(passes.map((pass) => pass.lens)).toEqual([...REVIEW_LENS_SEQUENCE])
    expect(passes.every((pass) => pass.state === 'pending')).toBe(true)
  })

  it('runs the lenses in order, quality first', () => {
    const pass = checkpoints.startLens(storyId, 'quality', openSession('claude-qual-1'))
    expect(pass.state).toBe('running')
    expect(pass.agentName).toBe('claude-qual-1')
  })

  it('refuses a lens whose predecessor has not passed', () => {
    expect(() => checkpoints.startLens(storyId, 'security', openSession('claude-sec-1'))).toThrow(
      LensOutOfOrderError,
    )
  })

  it('unlocks the next lens once the previous one has passed', () => {
    checkpoints.startLens(storyId, 'quality', openSession('claude-qual-1'))
    checkpoints.passLens(storyId, 'quality')
    expect(checkpoints.startLens(storyId, 'security', openSession('claude-sec-1')).state).toBe(
      'running',
    )
  })

  it('refuses the reviewed checkpoint while a lens has not passed', () => {
    checkpoints.startLens(storyId, 'quality', openSession('claude-qual-1'))
    checkpoints.passLens(storyId, 'quality')
    expect(() =>
      checkpoints.proveCheckpoint({
        storyId,
        name: 'reviewed',
        evidencePath: '.claude/evidence/PS-1/reviewed.md',
      }),
    ).toThrow(ReviewIncompleteError)
  })

  it('proves the reviewed checkpoint once the three lenses have passed', () => {
    for (const lens of REVIEW_LENS_SEQUENCE) {
      checkpoints.startLens(storyId, lens, openSession(`claude-${lens}-1`))
      checkpoints.passLens(storyId, lens)
    }
    expect(
      checkpoints.proveCheckpoint({
        storyId,
        name: 'reviewed',
        evidencePath: '.claude/evidence/PS-1/reviewed.md',
      }).name,
    ).toBe('reviewed')
  })

  it('refuses to pass a lens that still carries a strong finding', () => {
    const claudeSessionId = openSession('claude-qual-1')
    checkpoints.startLens(storyId, 'quality', claudeSessionId)
    checkpoints.recordFinding({
      storyId,
      claudeSessionId,
      lens: 'quality',
      severity: 'strong',
      path: 'src/domain/Cart/CartTotals.ts',
      statement: 'Le total repasse a zero apres un retrait',
    })
    expect(() => checkpoints.passLens(storyId, 'quality')).toThrow()
  })
})
