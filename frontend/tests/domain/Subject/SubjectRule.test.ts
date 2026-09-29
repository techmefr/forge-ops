import { describe, expect, it } from 'vitest'
import type { EpicOverview } from '@contract/StoryContract'
import {
  VIEW_ALL,
  VIEW_LATE,
  VIEW_NONE,
  blockedDays,
  dueBadge,
  filterCounts,
  flagsOf,
  loadOf,
  loadText,
  loadTone,
  narrow,
  sortSubjects,
  stepSelection,
  subjectsOfView,
  viewCounts,
} from '@/domain/Subject/SubjectRule'

let next = 1

function subject(over: Partial<EpicOverview> = {}): EpicOverview {
  const id = next++
  return {
    id,
    projectId: 1,
    title: `Subject ${id}`,
    businessIntent: '',
    assignee: null,
    storyCount: 0,
    priority: 'normal',
    startedOn: null,
    statusNote: null,
    requestedBy: null,
    tags: [],
    links: [],
    dependsOn: [],
    state: 'todo',
    progress: { delivered: 0, total: 0 },
    lateDays: null,
    dueOn: null,
    nextEvent: null,
    blockedSince: null,
    waitingOn: [],
    deletedAt: null,
    ...over,
  }
}

const TODAY = '2026-09-29'

describe('the load of a person', () => {
  it('counts the subjects in progress or blocked that are theirs, in every project', () => {
    const all = [
      subject({ assignee: 'anna', state: 'doing' }),
      subject({ assignee: 'anna', state: 'blocked', projectId: 2 }),
      subject({ assignee: 'anna', state: 'todo' }),
      subject({ assignee: 'anna', state: 'done' }),
      subject({ assignee: 'bob', state: 'doing' }),
    ]
    expect(loadOf(all, 'anna')).toBe(2)
  })

  it('is neutral under the capacity, full at it and over above it', () => {
    expect(loadTone(1, 3)).toBe('neutral')
    expect(loadTone(3, 3)).toBe('full')
    expect(loadTone(4, 3)).toBe('over')
  })

  it('stays neutral without a capacity and shows the count alone', () => {
    expect(loadTone(9, null)).toBe('neutral')
    expect(loadText(9, null)).toBe('9')
    expect(loadText(2, 3)).toBe('2/3')
  })
})

describe('narrowing by the toolbar', () => {
  const skera = subject({ projectId: 1, title: 'Cloudmail', tags: [{ id: 7, label: 'Urgent', colour: '#f00', usage: 1 }] })
  const forge = subject({ projectId: 2, title: 'Billing', statusNote: 'waiting for the vendor' })

  it('keeps everything without a facet', () => {
    expect(narrow([skera, forge], { project: null, tag: null, q: '' })).toHaveLength(2)
  })

  it('narrows by project, tag and search together', () => {
    expect(narrow([skera, forge], { project: 2, tag: null, q: '' })).toEqual([forge])
    expect(narrow([skera, forge], { project: null, tag: 7, q: '' })).toEqual([skera])
    expect(narrow([skera, forge], { project: null, tag: null, q: 'VENDOR' })).toEqual([forge])
    expect(narrow([skera, forge], { project: 1, tag: null, q: 'billing' })).toEqual([])
  })
})

describe('the flags under a name', () => {
  it('counts the late and the blocked subjects of the person only', () => {
    const all = [
      subject({ assignee: 'anna', state: 'doing', lateDays: 3 }),
      subject({ assignee: 'anna', state: 'blocked' }),
      subject({ assignee: 'anna', state: 'blocked', lateDays: 1 }),
      subject({ assignee: 'bob', state: 'blocked', lateDays: 5 }),
      subject({ assignee: 'anna', state: 'done' }),
    ]
    expect(flagsOf(all, 'anna')).toEqual({ late: 2, blocked: 2 })
  })
})

describe('the counts next to the views', () => {
  const all = [
    subject({ assignee: 'anna', state: 'doing', lateDays: 2 }),
    subject({ state: 'todo' }),
    subject({ state: 'todo', lateDays: 4 }),
    subject({ assignee: 'anna', state: 'done' }),
  ]
  const trash = [subject({ state: 'trash', deletedAt: '2026-09-01' })]

  it('match the lists they open', () => {
    const counts = viewCounts(all)
    expect(counts).toEqual({ all: 3, late: 2, none: 2 })
    expect(subjectsOfView(VIEW_ALL, all, trash, 'open')).toHaveLength(counts.all)
    expect(subjectsOfView(VIEW_LATE, all, trash, 'open')).toHaveLength(counts.late)
    expect(subjectsOfView(VIEW_NONE, all, trash, 'open')).toHaveLength(counts.none)
  })

  it('give a count to every state filter, deleted ones included', () => {
    expect(filterCounts(all, trash)).toEqual({
      open: 3,
      late: 2,
      todo: 2,
      doing: 1,
      blocked: 0,
      done: 1,
      trash: 1,
    })
  })

  it('open the deleted subjects for the deleted filter and nothing else', () => {
    expect(subjectsOfView(VIEW_ALL, all, trash, 'trash')).toEqual(trash)
    expect(subjectsOfView(VIEW_ALL, all, trash, 'done')).toHaveLength(1)
  })

  it('lists the open subjects of a person, not the delivered ones', () => {
    expect(subjectsOfView('anna', all, trash, 'open')).toHaveLength(1)
  })
})

describe('the order of a list', () => {
  it('puts the late first, then the blocked, then by due date, then by priority', () => {
    const lateMore = subject({ lateDays: 9, dueOn: '2026-09-20' })
    const lateLess = subject({ lateDays: 2, dueOn: '2026-09-27' })
    const blocked = subject({ state: 'blocked', dueOn: '2026-12-01' })
    const soon = subject({ dueOn: '2026-10-05', priority: 'low' })
    const soonMax = subject({ dueOn: '2026-10-05', priority: 'max' })
    const undated = subject({})
    const sorted = sortSubjects([undated, soon, blocked, lateLess, soonMax, lateMore])
    expect(sorted).toEqual([lateMore, lateLess, blocked, soonMax, soon, undated])
  })

  it('does not change the list it is given', () => {
    const one = subject({ priority: 'low' })
    const two = subject({ priority: 'max' })
    const given = [one, two]
    sortSubjects(given)
    expect(given).toEqual([one, two])
  })
})

describe('moving through the people', () => {
  const order = [VIEW_ALL, VIEW_LATE, VIEW_NONE, 'anna', 'bob']

  it('goes one step down or up', () => {
    expect(stepSelection(order, VIEW_LATE, 1)).toBe(VIEW_NONE)
    expect(stepSelection(order, 'anna', -1)).toBe(VIEW_NONE)
  })

  it('wraps around at both ends', () => {
    expect(stepSelection(order, 'bob', 1)).toBe(VIEW_ALL)
    expect(stepSelection(order, VIEW_ALL, -1)).toBe('bob')
  })

  it('falls back to the first entry when the current one is gone', () => {
    expect(stepSelection(order, 'zed', 1)).toBe(VIEW_ALL)
  })
})

describe('the due badge', () => {
  it('shows the date once delivered and a dash without one', () => {
    expect(dueBadge('2026-09-01', 'done', TODAY)).toEqual({ kind: 'date', days: 0 })
    expect(dueBadge(null, 'doing', TODAY)).toEqual({ kind: 'none', days: 0 })
  })

  it('counts days behind, today, soon and ahead', () => {
    expect(dueBadge('2026-09-26', 'doing', TODAY)).toEqual({ kind: 'late', days: 3 })
    expect(dueBadge('2026-09-29', 'doing', TODAY)).toEqual({ kind: 'today', days: 0 })
    expect(dueBadge('2026-10-02', 'doing', TODAY)).toEqual({ kind: 'soon', days: 3 })
    expect(dueBadge('2026-10-20', 'doing', TODAY)).toEqual({ kind: 'ahead', days: 21 })
  })
})

describe('how long a subject has been blocked', () => {
  it('counts whole days since it became blocked', () => {
    expect(blockedDays('2026-09-25T08:00:00.000Z', TODAY)).toBe(4)
    expect(blockedDays('2026-09-29T20:00:00.000Z', TODAY)).toBe(0)
  })

  it('says nothing for a subject that is not blocked', () => {
    expect(blockedDays(null, TODAY)).toBeNull()
  })
})
