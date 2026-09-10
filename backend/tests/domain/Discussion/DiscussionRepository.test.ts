import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createDiscussionRepository,
  type DiscussionRepository,
} from '../../../src/domain/Discussion/DiscussionRepository.js'
import {
  EmptyRemarkError,
  StoryAlreadyHeldError,
} from '../../../src/domain/Discussion/DiscussionViolation.js'
import { StoryNotFoundError } from '../../../src/domain/Story/StoryViolation.js'

let db: Database.Database
let discussion: DiscussionRepository
let storyId: number
let otherStoryId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  otherStoryId = stories.writeStory({ epicId: epic.id, title: 'supprimer les mails', body: 'en tant que...' }).id
  discussion = createDiscussionRepository(db, { stories })
})

describe('writeRemark', () => {
  it('keeps a remark in the thread of its story', () => {
    discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: 'il manque le cas vide' })

    expect(discussion.listRemarks(storyId).map((remark) => remark.body)).toEqual([
      'il manque le cas vide',
    ])
  })

  it('keeps the remarks in the order they were written', () => {
    discussion.writeRemark({ storyId, author: 'neo', voice: 'agent', body: 'je propose ceci' })
    discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: 'vas-y' })

    expect(discussion.listRemarks(storyId).map((remark) => remark.author)).toEqual(['neo', 'local'])
  })

  it('does not mix the threads of two stories', () => {
    discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: 'ici' })
    discussion.writeRemark({ storyId: otherStoryId, author: 'local', voice: 'human', body: 'la bas' })

    expect(discussion.listRemarks(storyId).map((remark) => remark.body)).toEqual(['ici'])
  })

  it('refuses a blank remark', () => {
    expect(() =>
      discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: '   ' }),
    ).toThrow(EmptyRemarkError)
  })

  it('refuses a remark on an unknown story', () => {
    expect(() =>
      discussion.writeRemark({ storyId: 9999, author: 'local', voice: 'human', body: 'ohe' }),
    ).toThrow(StoryNotFoundError)
  })

  it('trims what it keeps', () => {
    const remark = discussion.writeRemark({
      storyId,
      author: 'local',
      voice: 'human',
      body: '  au propre  ',
    })

    expect(remark.body).toBe('au propre')
  })
})

describe('hold', () => {
  it('raises a hold that names its reason', () => {
    discussion.hold({ storyId, reason: 'le plan touche deux projets', askedBy: 'elrond' })

    expect(discussion.openHold(storyId)?.reason).toBe('le plan touche deux projets')
  })

  it('leaves a story free until something holds it', () => {
    expect(discussion.openHold(storyId)).toBe(null)
  })

  it('refuses a second hold on a story already held', () => {
    discussion.hold({ storyId, reason: 'premier', askedBy: 'elrond' })

    expect(() => discussion.hold({ storyId, reason: 'second', askedBy: 'seraph' })).toThrow(
      StoryAlreadyHeldError,
    )
  })

  it('refuses to hold an unknown story', () => {
    expect(() => discussion.hold({ storyId: 9999, reason: 'ohe', askedBy: 'elrond' })).toThrow(
      StoryNotFoundError,
    )
  })

  it('lists every story held, and only those', () => {
    discussion.hold({ storyId, reason: 'a moi', askedBy: 'elrond' })

    expect(discussion.openHolds().map((held) => held.storyId)).toEqual([storyId])
  })
})

describe('a human reply lifts the hold', () => {
  it('frees the story when a human answers in the thread', () => {
    discussion.hold({ storyId, reason: 'il me faut un arbitrage', askedBy: 'elrond' })

    discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: 'fais le simple' })

    expect(discussion.openHold(storyId)).toBe(null)
  })

  it('leaves the hold in place when an agent talks to itself', () => {
    discussion.hold({ storyId, reason: 'il me faut un arbitrage', askedBy: 'elrond' })

    discussion.writeRemark({ storyId, author: 'neo', voice: 'agent', body: 'je relance' })

    expect(discussion.openHold(storyId)?.reason).toBe('il me faut un arbitrage')
  })

  it('does not free a neighbour story', () => {
    discussion.hold({ storyId, reason: 'a moi', askedBy: 'elrond' })

    discussion.writeRemark({ storyId: otherStoryId, author: 'local', voice: 'human', body: 'ailleurs' })

    expect(discussion.openHold(storyId)?.reason).toBe('a moi')
  })

  it('allows a new hold once the first was lifted', () => {
    discussion.hold({ storyId, reason: 'premier', askedBy: 'elrond' })
    discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: 'reponse' })

    discussion.hold({ storyId, reason: 'second', askedBy: 'seraph' })

    expect(discussion.openHold(storyId)?.reason).toBe('second')
  })

  it('keeps the remark that lifted the hold in the thread', () => {
    discussion.hold({ storyId, reason: 'premier', askedBy: 'elrond' })

    discussion.writeRemark({ storyId, author: 'local', voice: 'human', body: 'reponse' })

    expect(discussion.listRemarks(storyId).map((remark) => remark.body)).toEqual(['reponse'])
  })
})
