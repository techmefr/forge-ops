import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createStoryRepository,
  type StoryRepository,
} from '../../../src/domain/Story/StoryRepository.js'

let db: Database.Database
let stories: StoryRepository
let clock: string
let projectId: number
let epicId: number

const TODAY = '2026-09-29'

function twinnedStory(target: number, title: string): number {
  const story = stories.writeStory({ epicId: target, title, body: 'body' })
  stories.writeTwin({ storyId: story.id, title: `${title} test`, body: 'body' })
  return story.id
}

function overview(target = epicId) {
  const found = stories.listEpics(projectId, { today: TODAY }).find((epic) => epic.id === target)
  if (found === undefined) {
    throw new Error('epic missing from the overview')
  }
  return found
}

beforeEach(() => {
  db = openDatabase(':memory:')
  clock = '2026-09-01T08:00:00.000Z'
  stories = createStoryRepository(db, { now: () => clock })
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'Cloudmail', businessIntent: 'Mail' }).id
})

describe('the planning fields of an epic', () => {
  it('starts at normal priority with nothing else filled', () => {
    expect(overview()).toMatchObject({
      priority: 'normal',
      startedOn: null,
      statusNote: null,
      requestedBy: null,
      tags: [],
      links: [],
      dependsOn: [],
      waitingOn: [],
      deletedAt: null,
    })
  })

  it('takes a priority, a start date, a note and a requester', () => {
    stories.epics.plan(epicId, {
      priority: 'max',
      startedOn: '2026-09-10',
      statusNote: 'Where we are.',
      requestedBy: 'Anthony',
    })
    expect(overview()).toMatchObject({
      priority: 'max',
      startedOn: '2026-09-10',
      statusNote: 'Where we are.',
      requestedBy: 'Anthony',
    })
  })

  it('leaves untouched what the patch does not name', () => {
    stories.epics.plan(epicId, { priority: 'low', requestedBy: 'Anthony' })
    stories.epics.plan(epicId, { statusNote: 'Later' })
    expect(overview()).toMatchObject({ priority: 'low', requestedBy: 'Anthony', statusNote: 'Later' })
  })

  it('clears a nullable field when the patch says null', () => {
    stories.epics.plan(epicId, { requestedBy: 'Anthony' })
    stories.epics.plan(epicId, { requestedBy: null })
    expect(overview().requestedBy).toBeNull()
  })

  it('replaces the typed links', () => {
    stories.epics.plan(epicId, { links: [{ kind: 'repo', url: 'https://example.com/a' }] })
    stories.epics.plan(epicId, { links: [{ kind: 'doc', url: 'https://example.com/b' }] })
    expect(overview().links).toEqual([{ kind: 'doc', url: 'https://example.com/b' }])
  })

  it('gives a project the same typed links', () => {
    stories.epics.setProjectLinks(projectId, [{ kind: 'graphify', url: 'https://example.com/g' }])
    expect(stories.epics.projectLinks(projectId)).toEqual([
      { kind: 'graphify', url: 'https://example.com/g' },
    ])
  })

  it('refuses an unknown epic', () => {
    expect(() => stories.epics.plan(epicId + 50, { priority: 'low' })).toThrow('introuvable')
  })
})

describe('tags', () => {
  it('shares one tag between epics of different projects', () => {
    const other = stories.createProject({
      slug: 'other',
      name: 'Other',
      repositoryUrl: 'git@example.com:o.git',
      integrationBranch: 'main',
      colour: '#00ff00',
    }).id
    const otherEpic = stories.createEpic({ projectId: other, title: 'B', businessIntent: 'b' }).id
    const tag = stories.epics.createTag({ label: 'Urgent', colour: '#ff0000' })
    stories.epics.plan(epicId, { tagIds: [tag.id] })
    stories.epics.plan(otherEpic, { tagIds: [tag.id] })
    expect(overview().tags).toEqual([{ id: tag.id, label: 'Urgent', colour: '#ff0000', usage: 2 }])
    expect(stories.epics.listTags()[0]?.usage).toBe(2)
  })

  it('refuses a tag that does not exist', () => {
    expect(() => stories.epics.plan(epicId, { tagIds: [99] })).toThrow('Tag 99')
  })

  it('refuses two tags with the same label', () => {
    stories.epics.createTag({ label: 'Urgent', colour: '#ff0000' })
    expect(() => stories.epics.createTag({ label: 'urgent', colour: '#00ff00' })).toThrow('urgent')
  })

  it('renames and recolours a tag', () => {
    const tag = stories.epics.createTag({ label: 'Urgent', colour: '#ff0000' })
    stories.epics.updateTag(tag.id, { label: 'Critical', colour: '#000000' })
    expect(stories.epics.listTags()).toEqual([
      { id: tag.id, label: 'Critical', colour: '#000000', usage: 0 },
    ])
  })

  it('refuses to delete a tag while an epic uses it', () => {
    const tag = stories.epics.createTag({ label: 'Urgent', colour: '#ff0000' })
    stories.epics.plan(epicId, { tagIds: [tag.id] })
    expect(() => stories.epics.deleteTag(tag.id)).toThrow('is used by')
    stories.epics.plan(epicId, { tagIds: [] })
    stories.epics.deleteTag(tag.id)
    expect(stories.epics.listTags()).toEqual([])
  })
})

describe('depends_on', () => {
  let second: number
  let third: number

  beforeEach(() => {
    second = stories.createEpic({ projectId, title: 'Second', businessIntent: 's' }).id
    third = stories.createEpic({ projectId, title: 'Third', businessIntent: 't' }).id
  })

  it('refuses an epic depending on itself', () => {
    expect(() => stories.epics.plan(epicId, { dependsOn: [epicId] })).toThrow('depend on itself')
  })

  it('refuses a direct loop', () => {
    stories.epics.plan(epicId, { dependsOn: [second] })
    expect(() => stories.epics.plan(second, { dependsOn: [epicId] })).toThrow('closes a loop')
  })

  it('refuses a longer loop', () => {
    stories.epics.plan(epicId, { dependsOn: [second] })
    stories.epics.plan(second, { dependsOn: [third] })
    expect(() => stories.epics.plan(third, { dependsOn: [epicId] })).toThrow('closes a loop')
  })

  it('lets a replaced dependency be reversed', () => {
    stories.epics.plan(epicId, { dependsOn: [second] })
    stories.epics.plan(epicId, { dependsOn: [] })
    stories.epics.plan(second, { dependsOn: [epicId] })
    expect(overview(second).dependsOn).toEqual([epicId])
  })

  it('refuses an unknown epic', () => {
    expect(() => stories.epics.plan(epicId, { dependsOn: [999] })).toThrow('introuvable')
  })

  it('names the unfinished epic an epic is waiting on', () => {
    stories.epics.plan(epicId, { dependsOn: [second] })
    expect(overview().waitingOn).toEqual([{ id: second, title: 'Second' }])
  })

  it('stops waiting once the other epic is delivered', () => {
    stories.epics.plan(epicId, { dependsOn: [second] })
    const story = twinnedStory(second, 'Only story')
    stories.moveToState(story, 'done')
    expect(overview().waitingOn).toEqual([])
  })

  it('does not wait on an epic in the trash', () => {
    stories.epics.plan(epicId, { dependsOn: [second] })
    stories.epics.softDelete(second, 'gaetan')
    expect(overview().waitingOn).toEqual([])
  })

  it('leaves nothing half written when one dependency is refused', () => {
    expect(() => stories.epics.plan(epicId, { priority: 'max', dependsOn: [epicId] })).toThrow()
    expect(overview().priority).toBe('normal')
  })
})

describe('the derived state, progress and history', () => {
  it('opens the history with the to do state', () => {
    expect(stories.epics.history(epicId)).toEqual([{ state: 'todo', at: clock, by: 'system' }])
    expect(overview().state).toBe('todo')
  })

  it('is to do while the stories are only written', () => {
    twinnedStory(epicId, 'One')
    expect(overview()).toMatchObject({ state: 'todo', progress: { delivered: 0, total: 1 } })
  })

  it('goes to doing once a story is being built', () => {
    const story = twinnedStory(epicId, 'One')
    clock = '2026-09-02T08:00:00.000Z'
    stories.moveToState(story, 'building')
    expect(overview().state).toBe('doing')
    expect(stories.epics.history(epicId).map((change) => change.state)).toEqual(['todo', 'doing'])
  })

  it('goes to blocked while a story is blocked and remembers since when', () => {
    const story = twinnedStory(epicId, 'One')
    stories.moveToState(story, 'building')
    clock = '2026-09-05T08:00:00.000Z'
    stories.blockStory(story, 'waiting for the client')
    expect(overview()).toMatchObject({ state: 'blocked', blockedSince: clock })
    clock = '2026-09-06T08:00:00.000Z'
    stories.unblockStory(story)
    expect(overview()).toMatchObject({ state: 'doing', blockedSince: null })
  })

  it('takes the date of the last change to blocked', () => {
    const story = twinnedStory(epicId, 'One')
    stories.moveToState(story, 'building')
    clock = '2026-09-05T08:00:00.000Z'
    stories.blockStory(story, 'first')
    clock = '2026-09-06T08:00:00.000Z'
    stories.unblockStory(story)
    clock = '2026-09-10T08:00:00.000Z'
    stories.blockStory(story, 'second')
    expect(overview().blockedSince).toBe('2026-09-10T08:00:00.000Z')
  })

  it('goes to done when every story is delivered', () => {
    const one = twinnedStory(epicId, 'One')
    const two = twinnedStory(epicId, 'Two')
    stories.moveToState(one, 'done')
    expect(overview()).toMatchObject({ state: 'doing', progress: { delivered: 1, total: 2 } })
    stories.moveToState(two, 'done')
    expect(overview()).toMatchObject({ state: 'done', progress: { delivered: 2, total: 2 } })
  })

  it('does not write a row when the derived state did not change', () => {
    const story = twinnedStory(epicId, 'One')
    stories.editStory(story, { title: 'Renamed', body: 'body' })
    stories.moveToState(story, 'architecture')
    stories.moveToState(story, 'plan_review')
    expect(stories.epics.history(epicId).map((change) => change.state)).toEqual(['todo', 'doing'])
  })

  it('records the author of a change it derives as the system', () => {
    const story = twinnedStory(epicId, 'One')
    stories.moveToState(story, 'building')
    expect(stories.epics.history(epicId).at(-1)?.by).toBe('system')
  })
})

describe('late epics', () => {
  it('counts the days past the next milestone', () => {
    stories.writeMilestone({ epicId, kind: 'demo', dueOn: '2026-09-24' })
    expect(overview().lateDays).toBe(5)
  })

  it('is not late while the next milestone is ahead', () => {
    stories.writeMilestone({ epicId, kind: 'demo', dueOn: '2026-09-20' })
    stories.writeMilestone({ epicId, kind: 'production', dueOn: '2026-10-20' })
    expect(overview().lateDays).toBeNull()
  })

  it('is not late without a milestone', () => {
    expect(overview().lateDays).toBeNull()
  })

  it('is not late once delivered', () => {
    stories.writeMilestone({ epicId, kind: 'demo', dueOn: '2026-09-24' })
    stories.moveToState(twinnedStory(epicId, 'One'), 'done')
    expect(overview().lateDays).toBeNull()
  })
})

describe('soft delete', () => {
  it('hides the epic from the project list and keeps it in the trash list', () => {
    stories.epics.softDelete(epicId, 'gaetan')
    expect(stories.listEpics(projectId, { today: TODAY })).toEqual([])
    const trashed = stories.listEpics(projectId, { today: TODAY, deleted: true })
    expect(trashed).toMatchObject([{ id: epicId, state: 'trash', deletedAt: clock }])
  })

  it('writes the deletion and the restore in the history under the author', () => {
    stories.epics.softDelete(epicId, 'gaetan')
    stories.epics.restore(epicId, 'marie')
    expect(stories.epics.history(epicId).map((change) => [change.state, change.by])).toEqual([
      ['todo', 'system'],
      ['trash', 'gaetan'],
      ['todo', 'marie'],
    ])
    expect(overview().deletedAt).toBeNull()
  })

  it('refuses to delete twice or to restore what is not deleted', () => {
    expect(() => stories.epics.restore(epicId, 'gaetan')).toThrow('not in the bin')
    stories.epics.softDelete(epicId, 'gaetan')
    expect(() => stories.epics.softDelete(epicId, 'gaetan')).toThrow('introuvable')
  })

  it('refuses to edit an epic in the trash', () => {
    stories.epics.softDelete(epicId, 'gaetan')
    expect(() => stories.epics.plan(epicId, { priority: 'low' })).toThrow('introuvable')
  })

  it('purges after ninety days and not before', () => {
    stories.epics.softDelete(epicId, 'gaetan')
    clock = '2026-11-29T07:59:59.000Z'
    expect(stories.epics.purgeExpired()).toBe(0)
    clock = '2026-11-30T08:00:00.000Z'
    expect(stories.epics.purgeExpired()).toBe(1)
    expect(stories.listEpics(projectId, { today: TODAY, deleted: true })).toEqual([])
    expect(() => stories.epics.history(epicId)).toThrow('introuvable')
  })

  it('keeps an epic that still owns stories', () => {
    twinnedStory(epicId, 'One')
    stories.epics.softDelete(epicId, 'gaetan')
    clock = '2027-03-01T08:00:00.000Z'
    expect(stories.epics.purgeExpired()).toBe(0)
  })

  it('never purges a live epic', () => {
    clock = '2028-01-01T08:00:00.000Z'
    expect(stories.epics.purgeExpired()).toBe(0)
    expect(overview().id).toBe(epicId)
  })
})
