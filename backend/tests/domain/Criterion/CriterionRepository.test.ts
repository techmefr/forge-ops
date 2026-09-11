import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createCriterionRepository,
  type CriterionRepository,
} from '../../../src/domain/Criterion/CriterionRepository.js'
import {
  CriterionAlreadySatisfiedError,
  CriterionEvidenceRequiredError,
  CriterionNotFoundError,
  CriterionOnTwinError,
} from '../../../src/domain/Criterion/CriterionViolation.js'

let stories: StoryRepository
let criteria: CriterionRepository
let storyId: number
let twinId: number

beforeEach(() => {
  const db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  criteria = createCriterionRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' })
  storyId = story.id
  twinId = stories.writeTwin({ storyId: story.id, title: 'tests visualiser', body: 'cas...' }).id
})

describe('declareCriterion', () => {
  it('writes a criterion that starts unsatisfied', () => {
    const criterion = criteria.declareCriterion({
      storyId,
      reference: 'AC-1',
      statement: 'la liste affiche les mails du client connecte',
    })

    expect(criterion).toMatchObject({ reference: 'AC-1', satisfied: false, evidencePath: null })
  })

  it('carries the persona and the expected refusal', () => {
    const criterion = criteria.declareCriterion({
      storyId,
      reference: 'AC-2',
      statement: 'un visiteur ne voit aucun mail',
      persona: 'visiteur',
      expectsRefusal: true,
    })

    expect(criterion).toMatchObject({ persona: 'visiteur', expectsRefusal: true })
  })

  it('refuses a criterion carried by the twin instead of the functional story', () => {
    expect(() =>
      criteria.declareCriterion({ storyId: twinId, reference: 'AC-1', statement: 'peu importe' }),
    ).toThrow(CriterionOnTwinError)
  })
})

describe('listCriteria', () => {
  it('lists the criteria of a story in reference order', () => {
    criteria.declareCriterion({ storyId, reference: 'AC-2', statement: 'deuxieme' })
    criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'premier' })

    expect(criteria.listCriteria(storyId).map((criterion) => criterion.reference)).toEqual(['AC-1', 'AC-2'])
  })
})

describe('satisfyCriterion', () => {
  it('satisfies a criterion against its proof', () => {
    const criterion = criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'premier' })

    const satisfied = criteria.satisfyCriterion(criterion.id, '.claude/evidence/FORGE-1/tests.md')

    expect(satisfied).toMatchObject({
      satisfied: true,
      evidencePath: '.claude/evidence/FORGE-1/tests.md',
    })
  })

  it('refuses to satisfy a criterion without a proof', () => {
    const criterion = criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'premier' })

    expect(() => criteria.satisfyCriterion(criterion.id, '   ')).toThrow(CriterionEvidenceRequiredError)
  })

  it('refuses to satisfy the same criterion twice', () => {
    const criterion = criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'premier' })
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/FORGE-1/tests.md')

    expect(() => criteria.satisfyCriterion(criterion.id, '.claude/evidence/FORGE-1/tests.md')).toThrow(
      CriterionAlreadySatisfiedError,
    )
  })

  it('reports an unknown criterion', () => {
    expect(() => criteria.satisfyCriterion(404, '.claude/evidence/FORGE-1/tests.md')).toThrow(
      CriterionNotFoundError,
    )
  })
})

describe('listUnmetCriteria', () => {
  it('keeps only what is not satisfied yet', () => {
    const first = criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'premier' })
    criteria.declareCriterion({ storyId, reference: 'AC-2', statement: 'deuxieme' })
    criteria.satisfyCriterion(first.id, '.claude/evidence/FORGE-1/tests.md')

    expect(criteria.listUnmetCriteria(storyId).map((criterion) => criterion.reference)).toEqual(['AC-2'])
  })
})
