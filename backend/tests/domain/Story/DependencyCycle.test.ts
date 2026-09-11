import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { DependencyCycleError, SelfDependencyError } from '../../../src/domain/Story/StoryViolation.js'

let db: Database.Database
let stories: StoryRepository
let ids: number[]

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  ids = ['une', 'deux', 'trois', 'quatre'].map(
    (title) => stories.writeStory({ epicId: epic.id, title, body: 'en tant que...' }).id,
  )
})

function link(blockedIndex: number, blockingIndex: number): void {
  stories.addDependency({ blockedStoryId: ids[blockedIndex] ?? 0, blockingStoryId: ids[blockingIndex] ?? 0 })
}

describe('addDependency', () => {
  it('accepte une chaine sans boucle', () => {
    link(0, 1)
    link(1, 2)

    expect(stories.listBlockers(ids[0] ?? 0)).toHaveLength(1)
  })

  it('refuse une story qui se bloque elle-meme', () => {
    expect(() =>
      stories.addDependency({ blockedStoryId: ids[0] ?? 0, blockingStoryId: ids[0] ?? 0 }),
    ).toThrow(SelfDependencyError)
  })

  it('refuse le cycle direct entre deux stories', () => {
    link(0, 1)

    expect(() => link(1, 0)).toThrow(DependencyCycleError)
  })

  it('refuse un cycle qui passe par une troisieme story', () => {
    link(0, 1)
    link(1, 2)

    expect(() => link(2, 0)).toThrow(DependencyCycleError)
  })

  it('ne cree aucun lien quand le cycle est refuse', () => {
    link(0, 1)
    try {
      link(1, 0)
    } catch {
    }

    expect(stories.listBlockers(ids[1] ?? 0)).toHaveLength(0)
  })

  it('accepte deux stories qui bloquent la meme troisieme', () => {
    link(0, 1)
    link(0, 2)

    expect(stories.listBlockers(ids[0] ?? 0)).toHaveLength(2)
  })

  it('refuse le meme lien deux fois plutot que de le dupliquer', () => {
    link(0, 1)
    link(0, 1)

    expect(stories.listBlockers(ids[0] ?? 0)).toHaveLength(1)
  })
})

describe('listBlockers', () => {
  it('ne compte plus une story bloquante une fois qu elle est terminee', () => {
    link(0, 1)
    stories.markDone(ids[1] ?? 0)

    expect(stories.listBlockers(ids[0] ?? 0)).toHaveLength(0)
  })
})

describe('markDone', () => {
  it('rend debloquees les stories qui n attendaient plus que celle-la', () => {
    link(0, 1)
    link(2, 1)

    const unblocked = stories.markDoneAndUnblock(ids[1] ?? 0)

    expect(unblocked.map((story) => story.id).sort()).toEqual([ids[0], ids[2]].sort())
  })

  it('laisse bloquee une story qui attend encore quelqu un d autre', () => {
    link(0, 1)
    link(0, 2)

    const unblocked = stories.markDoneAndUnblock(ids[1] ?? 0)

    expect(unblocked).toHaveLength(0)
  })

  it('debloque en cascade quand la levee libere un maillon apres l autre', () => {
    link(0, 1)
    link(1, 2)

    const unblocked = stories.markDoneAndUnblock(ids[2] ?? 0)

    expect(unblocked.map((story) => story.id)).toEqual([ids[1]])
  })
})
