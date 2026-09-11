import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository, type CriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { StoryTooThinError } from '../../../src/domain/Dispatch/DispatchViolation.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let db: Database.Database
let stories: StoryRepository
let criteria: CriterionRepository
let dispatcher: Dispatcher
let launches: number

const CORPS = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

function writeStory(title: string, body: string): number {
  const project = stories.listProjects()[0]
  const epic = stories.listEpics(project?.id ?? 0)[0]
  return stories.writeStory({ epicId: epic?.id ?? 0, title, body }).id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  criteria = createCriterionRepository(db)
  launches = 0
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria,
    sessions: createAgentSessionRepository(db),
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: {
      launch: () => {
        launches += 1
        return Promise.resolve({ claudeSessionId: `session-${launches}` })
      },
    },
    concurrencyCap: 10,
    claudeCodeVersion: 'test',
  })
})

describe('le plancher de completude garde le dispatch', () => {
  it('laisse la phase spec partir sur une story encore mince, puisque spec sert a l etoffer', async () => {
    const storyId = writeStory('mails', '')

    await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(launches).toBe(1)
  })

  it('refuse une phase de production sur une story trop mince', async () => {
    const storyId = writeStory('mails', '')

    await expect(dispatcher.dispatch({ storyId, phase: 'architecture' })).rejects.toBeInstanceOf(
      StoryTooThinError,
    )
  })

  it('laisse partir la production quand la story tient debout', async () => {
    const storyId = writeStory('Visualiser la liste des mails du client', CORPS)
    stories.writeTwin({ storyId, title: 'tests visualiser', body: 'cas...' })
    criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la liste est paginee' })
    criteria.declareCriterion({ storyId, reference: 'AC-2', statement: 'le vide est annonce' })
    const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    })
    checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: '.claude/evidence/FORGE-1/spec.md' })
    criteria.satisfyCriterion(1, '.claude/evidence/FORGE-1/ac-1.md')
    criteria.satisfyCriterion(2, '.claude/evidence/FORGE-1/ac-2.md')

    await dispatcher.dispatch({ storyId, phase: 'architecture' })

    expect(launches).toBe(1)
  })

  it('dit ce qui manque dans son refus', async () => {
    const storyId = writeStory('mails', '')

    await expect(dispatcher.dispatch({ storyId, phase: 'architecture' })).rejects.toThrow(/critere/)
  })

  it('ne lance rien quand la story est refusee comme trop mince', async () => {
    const storyId = writeStory('mails', '')

    await dispatcher.dispatch({ storyId, phase: 'architecture' }).catch(() => null)

    expect(launches).toBe(0)
  })
})
