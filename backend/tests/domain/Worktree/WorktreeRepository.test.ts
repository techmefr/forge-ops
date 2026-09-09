import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createWorktreeRepository,
  type WorktreeRepository,
} from '../../../src/domain/Worktree/WorktreeRepository.js'
import {
  WorktreeAlreadyLiveError,
  WorktreeNotFoundError,
  WorktreeNotRemovableError,
} from '../../../src/domain/Worktree/WorktreeViolation.js'
import {
  allocatePort,
  DEFAULT_BASE_PORT,
  DEFAULT_PORT_RANGE,
} from '../../../src/technical/Network/PortAllocator.js'

type Added = { path: string; branch: string; baseRef: string }

let db: Database.Database
let stories: StoryRepository
let worktrees: WorktreeRepository
let added: Added[]
let removed: string[]
let dirty: Set<string>
let first: number
let second: number

function fakeGit() {
  return {
    headSha: (baseRef: string) => `sha-of-${baseRef}`,
    addWorktree: (input: Added) => {
      added.push(input)
    },
    removeWorktree: (path: string) => {
      removed.push(path)
    },
    isDirty: (path: string) => dirty.has(path),
  }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  added = []
  removed = []
  dirty = new Set()
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails',
  })
  first = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que' }).id
  second = stories.writeStory({ epicId: epic.id, title: 'supprimer les mails', body: 'en tant que' }).id
  worktrees = createWorktreeRepository(db, { stories, git: fakeGit(), root: '/tmp/forge-worktrees' })
})

describe('open', () => {
  it('names the branch after the story', () => {
    expect(worktrees.open({ storyId: first, baseRef: 'forge' }).branch).toBe(
      'story/forge-1-visualiser-les-mails',
    )
  })

  it('puts the worktree in its own folder under the root', () => {
    expect(worktrees.open({ storyId: first, baseRef: 'forge' }).path).toBe(
      '/tmp/forge-worktrees/story-forge-1-visualiser-les-mails',
    )
  })

  it('actually asks git to create it', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })

    expect(added).toEqual([
      {
        path: '/tmp/forge-worktrees/story-forge-1-visualiser-les-mails',
        branch: 'story/forge-1-visualiser-les-mails',
        baseRef: 'forge',
      },
    ])
  })

  it('records the commit the branch started from, so a rebase is traceable', () => {
    expect(worktrees.open({ storyId: first, baseRef: 'forge' }).baseSha).toBe('sha-of-forge')
  })

  it('reserves a port inside the allowed range', () => {
    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })

    expect(opened.port).toBeGreaterThanOrEqual(DEFAULT_BASE_PORT)
    expect(opened.port).toBeLessThan(DEFAULT_BASE_PORT + DEFAULT_PORT_RANGE)
  })

  it('gives the same branch the same port twice, so a bookmark keeps working', () => {
    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })
    worktrees.close(first)

    expect(worktrees.open({ storyId: first, baseRef: 'forge' }).port).toBe(opened.port)
  })

  it('steps aside when the port its name points at is already taken', () => {
    const wanted = allocatePort('story/forge-1-visualiser-les-mails')
    const other = worktrees.open({ storyId: second, baseRef: 'forge' })
    db.prepare('UPDATE port_reservation SET port = ? WHERE worktree_id = ?').run(wanted, other.id)

    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })

    expect(opened.port).not.toBe(wanted)
  })

  it('keeps the port it stepped aside to, even once the squatter has left', () => {
    const wanted = allocatePort('story/forge-1-visualiser-les-mails')
    const other = worktrees.open({ storyId: second, baseRef: 'forge' })
    db.prepare('UPDATE port_reservation SET port = ? WHERE worktree_id = ?').run(wanted, other.id)
    const displaced = worktrees.open({ storyId: first, baseRef: 'forge' }).port
    worktrees.close(first)
    worktrees.close(second)

    expect(worktrees.open({ storyId: first, baseRef: 'forge' }).port).toBe(displaced)
  })

  it('never gives two live worktrees the same port', () => {
    const one = worktrees.open({ storyId: first, baseRef: 'forge' })
    const two = worktrees.open({ storyId: second, baseRef: 'forge' })

    expect(two.port).not.toBe(one.port)
  })

  it('gives each worktree its own subdomain', () => {
    const one = worktrees.open({ storyId: first, baseRef: 'forge' })
    const two = worktrees.open({ storyId: second, baseRef: 'forge' })

    expect(two.subdomain).not.toBe(one.subdomain)
  })

  it('refuses to open a second worktree on a story already working', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })

    expect(() => worktrees.open({ storyId: first, baseRef: 'forge' })).toThrow(WorktreeAlreadyLiveError)
  })

  it('refuses to open one for a story that does not exist', () => {
    expect(() => worktrees.open({ storyId: 999, baseRef: 'forge' })).toThrow()
  })

  it('does not ask git anything when it refuses', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })
    added = []

    expect(() => worktrees.open({ storyId: first, baseRef: 'forge' })).toThrow()
    expect(added).toEqual([])
  })
})

describe('close', () => {
  it('asks git to remove the folder', () => {
    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })
    worktrees.close(first)

    expect(removed).toEqual([opened.path])
  })

  it('frees the port for another branch', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })
    worktrees.close(first)

    expect(worktrees.listLive()).toEqual([])
  })

  it('refuses to throw away uncommitted work', () => {
    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })
    dirty.add(opened.path)

    expect(() => worktrees.close(first)).toThrow(WorktreeNotRemovableError)
  })

  it('does not remove the folder it refused to remove', () => {
    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })
    dirty.add(opened.path)

    expect(() => worktrees.close(first)).toThrow()
    expect(removed).toEqual([])
  })

  it('throws away uncommitted work when the human insists', () => {
    const opened = worktrees.open({ storyId: first, baseRef: 'forge' })
    dirty.add(opened.path)

    expect(() => worktrees.close(first, { force: true })).not.toThrow()
    expect(removed).toEqual([opened.path])
  })

  it('refuses to close a story that has no worktree', () => {
    expect(() => worktrees.close(second)).toThrow(WorktreeNotFoundError)
  })

  it('refuses to close twice', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })
    worktrees.close(first)

    expect(() => worktrees.close(first)).toThrow(WorktreeNotFoundError)
  })
})

describe('listLive', () => {
  it('is empty on a fresh board', () => {
    expect(worktrees.listLive()).toEqual([])
  })

  it('names the story each worktree belongs to', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })

    expect(worktrees.listLive()[0]?.storyReference).toBe('FORGE-1')
  })

  it('lists both worktrees when two stories are working', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })
    worktrees.open({ storyId: second, baseRef: 'forge' })

    expect(worktrees.listLive()).toHaveLength(2)
  })
})

describe('findForStory', () => {
  it('rends nothing when the story never had one', () => {
    expect(worktrees.findForStory(first)).toBeNull()
  })

  it('finds the live worktree', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })

    expect(worktrees.findForStory(first)?.branch).toBe('story/forge-1-visualiser-les-mails')
  })

  it('rends nothing once it is closed', () => {
    worktrees.open({ storyId: first, baseRef: 'forge' })
    worktrees.close(first)

    expect(worktrees.findForStory(first)).toBeNull()
  })
})
