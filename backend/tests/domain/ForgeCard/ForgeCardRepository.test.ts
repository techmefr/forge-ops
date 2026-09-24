import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForgeCardRepository, type ForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  DuplicateStoryIdError,
  EmptySelectionError,
  ForgeCardNotFoundError,
  ForgeStoryNotFoundError,
  StoryAlreadyOnOpenCardError,
  StoryNotInBacklogError,
  UnknownForgeCardProviderError,
} from '../../../src/domain/ForgeCard/ForgeCardViolation.js'

let db: Database.Database
let stories: StoryRepository
let cards: ForgeCardRepository
let epicId: number
let firstStoryId: number
let secondStoryId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  cards = createForgeCardRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'demo', businessIntent: 'besoin' })
  epicId = epic.id
  const first = stories.writeStory({ epicId, title: 'premiere', body: 'corps' })
  const second = stories.writeStory({ epicId, title: 'seconde', body: 'corps' })
  stories.writeTwin({ storyId: first.id, title: 'jumelle 1', body: 'corps' })
  stories.sendToBacklog(first.id)
  stories.writeTwin({ storyId: second.id, title: 'jumelle 2', body: 'corps' })
  stories.sendToBacklog(second.id)
  firstStoryId = first.id
  secondStoryId = second.id
})

describe('createForgeCard', () => {
  it('cree une forge portant une story et l assigne', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(card.storyIds).toEqual([firstStoryId])
    expect(card.reference).toBe('FORGE-1')
    expect(card.closedAt).toBeNull()
  })

  it('cree une forge portant plusieurs stories', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId, secondStoryId] })
    expect(card.storyIds).toEqual([firstStoryId, secondStoryId])
  })

  it('refuse une selection vide', () => {
    expect(() => cards.createForgeCard({ storyIds: [] })).toThrow(EmptySelectionError)
  })

  it('refuse un doublon dans la selection', () => {
    expect(() => cards.createForgeCard({ storyIds: [firstStoryId, firstStoryId] })).toThrow(DuplicateStoryIdError)
  })

  it('refuse une story introuvable', () => {
    expect(() => cards.createForgeCard({ storyIds: [999] })).toThrow(ForgeStoryNotFoundError)
  })

  it('refuse une story qui n est pas dans le backlog', () => {
    const drafting = stories.writeStory({ epicId, title: 'brouillon', body: 'corps' })
    expect(() => cards.createForgeCard({ storyIds: [drafting.id] })).toThrow(StoryNotInBacklogError)
  })

  it('refuse une story deja portee par une forge ouverte', () => {
    cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(() => cards.createForgeCard({ storyIds: [firstStoryId] })).toThrow(StoryAlreadyOnOpenCardError)
  })

  it('accepte une story dont la forge precedente est fermee', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    cards.closeForgeCard(card.id)
    expect(() => cards.createForgeCard({ storyIds: [firstStoryId] })).not.toThrow()
  })
})

describe('provider de la forge', () => {
  it('nait pilotee par claude quand rien n est precise, comme avant le multi-provider', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(card.provider).toBe('claude')
  })

  it('retient le provider choisi une seule fois a la creation', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId], provider: 'codex' })
    expect(card.provider).toBe('codex')
    expect(cards.findForgeCard(card.id).provider).toBe('codex')
  })

  it('refuse un provider que personne ne reconnait', () => {
    expect(() =>
      cards.createForgeCard({ storyIds: [firstStoryId], provider: 'gpt5' as never }),
    ).toThrow(UnknownForgeCardProviderError)
  })
})

describe('openCardOfStory', () => {
  it('rend la forge ouverte qui porte la story', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(cards.openCardOfStory(firstStoryId)?.id).toBe(card.id)
  })

  it('rend null quand la story n est portee par aucune forge', () => {
    expect(cards.openCardOfStory(firstStoryId)).toBeNull()
  })
})

describe('createForgeCard sans session', () => {
  it('nait sans session claude ni phase courante', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    expect(card.claudeSessionId).toBeNull()
    expect(card.currentPhase).toBeNull()
  })
})

describe('recordDispatch', () => {
  it('memorise la session claude et la phase courante', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })

    const updated = cards.recordDispatch(card.id, { claudeSessionId: 'sess-1', phase: 'spec' })

    expect(updated.claudeSessionId).toBe('sess-1')
    expect(updated.currentPhase).toBe('spec')
  })

  it('ecrase la session precedente quand la carte avance de colonne', () => {
    const card = cards.createForgeCard({ storyIds: [firstStoryId] })
    cards.recordDispatch(card.id, { claudeSessionId: 'sess-1', phase: 'spec' })

    const updated = cards.recordDispatch(card.id, { claudeSessionId: 'sess-1', phase: 'architecture' })

    expect(updated.claudeSessionId).toBe('sess-1')
    expect(updated.currentPhase).toBe('architecture')
  })

  it('refuse une forge introuvable', () => {
    expect(() => cards.recordDispatch(999, { claudeSessionId: 'sess-1', phase: 'spec' })).toThrow(
      ForgeCardNotFoundError,
    )
  })
})
