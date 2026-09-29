import { describe, expect, it } from 'vitest'
import type { EpicOverview } from '@contract/StoryContract'
import {
  changesOf,
  creationOf,
  dependencyCandidates,
  emptyForm,
  firstIssueField,
  formOf,
  issuesOf,
  milestoneStep,
  stateAfterOwnerChange,
  toggled,
} from '@/domain/Subject/SubjectFormRule'

function subject(over: Partial<EpicOverview> = {}): EpicOverview {
  return {
    id: 1,
    projectId: 1,
    title: 'Cloudmail',
    businessIntent: 'Mail',
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

describe('issuesOf', () => {
  it('asks for a title and a project', () => {
    expect(issuesOf(emptyForm(null)).map((issue) => issue.field)).toEqual(['title', 'project'])
  })

  it('treats a blank title as missing', () => {
    expect(issuesOf({ ...emptyForm(1), title: '   ' }).map((issue) => issue.field)).toEqual(['title'])
  })

  it('accepts a title and a project', () => {
    expect(issuesOf({ ...emptyForm(1), title: 'Migration' })).toEqual([])
  })

  it('refuses a milestone before the start', () => {
    const form = { ...emptyForm(1), title: 'x', startedOn: '2026-09-10', milestone: '2026-09-09' }
    expect(issuesOf(form)).toEqual([{ field: 'milestone', message: 'subjects.form.errors.milestoneBeforeStart' }])
  })

  it('accepts a milestone on the start day and either date alone', () => {
    expect(issuesOf({ ...emptyForm(1), title: 'x', startedOn: '2026-09-10', milestone: '2026-09-10' })).toEqual([])
    expect(issuesOf({ ...emptyForm(1), title: 'x', milestone: '2026-09-10' })).toEqual([])
  })

  it('refuses a link that is not a web address but ignores blank rows', () => {
    const bad = { ...emptyForm(1), title: 'x', links: [{ kind: 'doc' as const, url: 'not a link' }] }
    expect(issuesOf(bad).map((issue) => issue.field)).toEqual(['links'])
    const ftp = { ...emptyForm(1), title: 'x', links: [{ kind: 'doc' as const, url: 'ftp://host/file' }] }
    expect(issuesOf(ftp).map((issue) => issue.field)).toEqual(['links'])
    const blank = { ...emptyForm(1), title: 'x', links: [{ kind: 'doc' as const, url: '  ' }] }
    expect(issuesOf(blank)).toEqual([])
  })

  it('refuses a status note over the limit', () => {
    expect(issuesOf({ ...emptyForm(1), title: 'x', note: 'a'.repeat(601) }).map((issue) => issue.field)).toEqual([
      'note',
    ])
  })
})

describe('firstIssueField', () => {
  it('follows the order of the form, not the order of the issues', () => {
    expect(
      firstIssueField([
        { field: 'links', message: 'a' },
        { field: 'title', message: 'b' },
      ]),
    ).toBe('title')
    expect(firstIssueField([])).toBeNull()
  })
})

describe('payloads', () => {
  it('sends nothing for an untouched optional field', () => {
    expect(creationOf({ ...emptyForm(3), title: '  Migration  ' })).toEqual({
      projectId: 3,
      assignee: null,
      title: 'Migration',
      priority: 'normal',
      startedOn: null,
      statusNote: null,
      requestedBy: null,
      tagIds: [],
      links: [],
      dependsOn: [],
    })
  })

  it('trims text, drops blank links and keeps the rest', () => {
    const form = {
      ...emptyForm(3),
      title: 'x',
      owner: 'anna',
      priority: 'high' as const,
      requestedBy: ' Anthony ',
      startedOn: '2026-09-10',
      note: ' hello ',
      tagIds: [4],
      dependsOn: [7],
      links: [
        { kind: 'repo' as const, url: ' https://example.com/r ' },
        { kind: 'doc' as const, url: '' },
      ],
    }
    expect(creationOf(form)).toMatchObject({ assignee: 'anna', priority: 'high' })
    expect(changesOf(form)).toEqual({
      title: 'x',
      priority: 'high',
      startedOn: '2026-09-10',
      statusNote: 'hello',
      requestedBy: 'Anthony',
      tagIds: [4],
      links: [{ kind: 'repo', url: 'https://example.com/r' }],
      dependsOn: [7],
    })
  })
})

describe('formOf', () => {
  it('prefills every field from the subject', () => {
    const form = formOf(
      subject({
        assignee: 'anna',
        priority: 'max',
        requestedBy: 'Anthony',
        startedOn: '2026-09-01',
        statusNote: 'Note',
        tags: [{ id: 2, label: 'urgent', colour: '#ff0000', usage: 1 }],
        links: [{ kind: 'doc', url: 'https://example.com' }],
        dependsOn: [9],
      }),
      '2026-10-01',
    )
    expect(form).toEqual({
      title: 'Cloudmail',
      projectId: 1,
      owner: 'anna',
      priority: 'max',
      requestedBy: 'Anthony',
      startedOn: '2026-09-01',
      milestone: '2026-10-01',
      note: 'Note',
      tagIds: [2],
      links: [{ kind: 'doc', url: 'https://example.com' }],
      dependsOn: [9],
    })
  })
})

describe('stateAfterOwnerChange', () => {
  it('starts a fresh subject when somebody takes it', () => {
    expect(stateAfterOwnerChange(subject(), 'anna')).toBe('doing')
  })

  it('puts it back to todo when nobody holds it any more', () => {
    expect(stateAfterOwnerChange(subject({ assignee: 'anna', state: 'doing' }), '')).toBe('todo')
  })

  it('leaves the state alone when the owner is unchanged, blocked, done or derived', () => {
    expect(stateAfterOwnerChange(subject({ assignee: 'anna', state: 'doing' }), 'anna')).toBeNull()
    expect(stateAfterOwnerChange(subject({ state: 'blocked' }), 'anna')).toBeNull()
    expect(stateAfterOwnerChange(subject({ state: 'done' }), 'anna')).toBeNull()
    expect(stateAfterOwnerChange(subject({ storyCount: 2 }), 'anna')).toBeNull()
  })
})

describe('milestoneStep', () => {
  it('creates, changes, removes or leaves the milestone', () => {
    expect(milestoneStep(null, '')).toBe('none')
    expect(milestoneStep(null, '2026-10-01')).toBe('create')
    expect(milestoneStep('2026-10-01', '2026-10-01')).toBe('none')
    expect(milestoneStep('2026-10-01', '2026-10-05')).toBe('change')
    expect(milestoneStep('2026-10-01', '')).toBe('remove')
  })
})

describe('toggled and dependencyCandidates', () => {
  it('adds then removes an id', () => {
    expect(toggled([1], 2)).toEqual([1, 2])
    expect(toggled([1, 2], 1)).toEqual([2])
  })

  it('offers neither the subject itself, nor deleted ones, nor those already picked', () => {
    const all = [subject({ id: 1 }), subject({ id: 2 }), subject({ id: 3, deletedAt: '2026-09-01' }), subject({ id: 4 })]
    expect(dependencyCandidates(all, 1, [4]).map((entry) => entry.id)).toEqual([2])
    expect(dependencyCandidates(all, null, []).map((entry) => entry.id)).toEqual([1, 2, 4])
  })
})
