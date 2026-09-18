import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createDiscussionRepository } from '../../../src/domain/Discussion/DiscussionRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import type { ProjectCard } from '../../../../contract/BoardContract.js'

const TODAY = '2026-09-18'

let api: Hono
let stories: StoryRepository
let discussion: ReturnType<typeof createDiscussionRepository>
let storyId: number
let epicId: number

async function cards(): Promise<readonly ProjectCard[]> {
  const answer = (await api.request('/api/board/projects')) as Response
  return (await answer.json()) as readonly ProjectCard[]
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  discussion = createDiscussionRepository(db, { stories })
  api = createBoardApi({
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db, {
      ...PERMISSIVE_CHECKPOINT_GATES,
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    }),
    criteria: createCriterionRepository(db),
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events: createEventBus(),
    dispatcher: {
      dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
      countRunning: () => 0,
    },
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
    openHolds: () => discussion.openHolds(),
    today: () => TODAY,
  })

  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: 'acc',
  })
  epicId = stories.createEpic({
    projectId: project.id,
    title: 'suivre les livraisons',
    businessIntent: 'voir ou en est chaque projet',
  }).id
  stories.claimEpic(epicId, 'gaetan')
  const story = stories.writeStory({
    epicId,
    title: 'afficher les cartes',
    body: 'une carte lisible de loin',
  })
  storyId = story.id
  stories.writeTwin({ storyId, title: 'tests des cartes', body: 'cas de lecture' })
  stories.sendToBacklog(storyId)
  stories.startBuilding(storyId)
})

describe('GET /api/board/projects', () => {
  it('donne a chaque carte son projet, son epique et sa personne', async () => {
    const [card] = await cards()

    expect(card?.projectSlug).toBe('forge')
    expect(card?.projectColour).toBe('acc')
    expect(card?.epicTitle).toBe('suivre les livraisons')
    expect(card?.holder).toBe('gaetan')
  })

  it('ne signale rien quand la story avance', async () => {
    const [card] = await cards()

    expect(card?.attention).toBeNull()
    expect(card?.milestone).toBeNull()
    expect(card?.daysLeft).toBeNull()
  })

  it('porte la date du jalon qui vient et les jours qui restent', async () => {
    stories.writeMilestone({ epicId, kind: 'demo', dueOn: '2026-09-21' })
    stories.writeMilestone({ epicId, kind: 'production', dueOn: '2026-10-10' })

    const [card] = await cards()

    expect(card?.milestone?.kind).toBe('demo')
    expect(card?.daysLeft).toBe(3)
  })

  it('signale une story en retard sur son jalon', async () => {
    stories.writeMilestone({ epicId, kind: 'demo', dueOn: '2026-09-10' })

    const [card] = await cards()

    expect(card?.attention).toBe('late')
    expect(card?.daysLeft).toBe(-8)
  })

  it('signale une story mise en attente a la main', async () => {
    discussion.hold({ storyId, reason: 'on attend le client', askedBy: 'gaetan' })

    const [card] = await cards()

    expect(card?.attention).toBe('blocked')
  })
})
