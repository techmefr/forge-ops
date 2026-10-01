import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import SubjectFormDialog from '@/domain/Subject/SubjectFormDialog.vue'
import type { EpicOverview, Project } from '@contract/StoryContract'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

const PROJECTS: Project[] = [
  { id: 1, slug: 'skera', name: 'Skera', repositoryUrl: 'u', integrationBranch: 'main', colour: '#ff3b00', checkoutPath: null },
  { id: 2, slug: 'forge', name: 'Forge', repositoryUrl: 'u', integrationBranch: 'main', colour: '#0f9d8a', checkoutPath: null },
]
const PEOPLE = [
  { login: 'anna', displayName: 'Anna Martin', capacity: 2, active: true },
  { login: 'bob', displayName: 'Bob Stone', capacity: null, active: true },
]
const TAGS = [{ id: 7, label: 'urgent', colour: '#ff0000', usage: 1 }]

function epic(over: Partial<EpicOverview> = {}): EpicOverview {
  return {
    id: 4,
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

const OTHERS = [epic({ id: 10, title: 'Billing', projectId: 2 }), epic({ id: 11, title: 'Invoices' })]

async function mounted(props: Record<string, unknown> = {}): Promise<VueWrapper> {
  const wrapper = mount(SubjectFormDialog, {
    attachTo: document.body,
    props: { subject: null, projects: PROJECTS, projectId: 1, people: PEOPLE, tags: TAGS, subjects: OTHERS, ...props },
    global: { plugins: [createBoardI18n('en')] },
  })
  await flushPromises()
  return wrapper
}

function field<T extends HTMLElement>(testId: string): T {
  const found = document.body.querySelector<T>(`[data-test-id="${testId}"]`)
  if (found === null) {
    throw new Error(`No element ${testId}`)
  }
  return found
}

async function type(testId: string, value: string): Promise<void> {
  const element = field<HTMLInputElement>(testId)
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}

async function submit(): Promise<void> {
  field<HTMLButtonElement>('subject-form-submit').click()
  await flushPromises()
}

beforeEach(() => {
  read.mockReset()
  read.mockResolvedValue([])
  send.mockReset()
  send.mockImplementation((path: string) => Promise.resolve(path === '/api/epics' ? { id: 9 } : {}))
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('creating a subject', () => {
  it('opens on the project of the toolbar with nobody as the owner', async () => {
    await mounted({ projectId: 2 })
    expect(field<HTMLInputElement>('subject-form-project').value).toBe('Forge')
    expect(field<HTMLSelectElement>('subject-form-owner').value).toBe('')
    expect(field<HTMLSelectElement>('subject-form-priority').value).toBe('normal')
  })

  it('shows the error in the form, focuses the field and sends nothing', async () => {
    const dialog = await mounted()
    await type('subject-form-note', 'Keep this text')
    await submit()
    expect(send).not.toHaveBeenCalled()
    expect(field('subject-form-title').getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById('subject-form-title-error')?.textContent).toContain('title')
    expect(field('subject-form-summary').textContent).toContain('1 field')
    expect(document.activeElement).toBe(field('subject-form-title'))
    expect(field<HTMLTextAreaElement>('subject-form-note').value).toBe('Keep this text')
    dialog.unmount()
  })

  it('sends every field of the form in one call', async () => {
    const dialog = await mounted()
    await type('subject-form-title', '  Migration SMTP ')
    await type('subject-form-owner', 'anna')
    await type('subject-form-priority', 'high')
    await type('subject-form-requested-by', 'Anthony')
    await type('subject-form-start', '2026-09-10')
    await type('subject-form-note', 'Two sentences.')
    field<HTMLButtonElement>('form-tag-7').click()
    field<HTMLButtonElement>('form-link-add').click()
    await flushPromises()
    await type('form-link-url', 'https://example.com/spec')
    await type('form-dependency-select', '10')
    field<HTMLButtonElement>('form-dependency-add').click()
    await flushPromises()
    await submit()
    expect(send).toHaveBeenCalledWith('/api/epics', 'POST', {
      projectId: 1,
      title: 'Migration SMTP',
      assignee: 'anna',
      priority: 'high',
      startedOn: '2026-09-10',
      statusNote: 'Two sentences.',
      requestedBy: 'Anthony',
      tagIds: [7],
      links: [{ kind: 'repo', url: 'https://example.com/spec' }],
      dependsOn: [10],
    })
    expect(dialog.emitted('saved')).toEqual([[9]])
  })

  it('creates the milestone as an event on the new subject', async () => {
    const dialog = await mounted()
    await type('subject-form-title', 'Migration')
    await type('subject-form-milestone', '2026-10-01')
    await submit()
    expect(send).toHaveBeenCalledWith(
      '/api/events',
      'POST',
      expect.objectContaining({ date: '2026-10-01', projectId: 1, epicId: 9, title: 'Migration' }),
    )
    expect(dialog.emitted('saved')).toEqual([[9]])
  })

  it('refuses a milestone before the start and keeps what was typed', async () => {
    await mounted()
    await type('subject-form-title', 'Migration')
    await type('subject-form-start', '2026-10-10')
    await type('subject-form-milestone', '2026-10-01')
    await submit()
    expect(send).not.toHaveBeenCalled()
    expect(field('subject-form-milestone').getAttribute('aria-invalid')).toBe('true')
    expect(field<HTMLInputElement>('subject-form-title').value).toBe('Migration')
    expect(field<HTMLInputElement>('subject-form-start').value).toBe('2026-10-10')
  })

  it('refuses a link that is not a web address', async () => {
    await mounted()
    await type('subject-form-title', 'Migration')
    field<HTMLButtonElement>('form-link-add').click()
    await flushPromises()
    await type('form-link-url', 'not a link')
    await submit()
    expect(send).not.toHaveBeenCalled()
    expect(field('form-link-url').getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById('subject-form-links-error')?.textContent).toContain('web address')
  })

  it('shows the refusal of the board without losing the typed input', async () => {
    send.mockRejectedValue(new Error('Cycle in dependencies'))
    await mounted()
    await type('subject-form-title', 'Migration')
    await type('subject-form-note', 'Keep me')
    await submit()
    expect(field('subject-form-refusal').textContent).toContain('Cycle in dependencies')
    expect(field<HTMLInputElement>('subject-form-title').value).toBe('Migration')
    expect(field<HTMLTextAreaElement>('subject-form-note').value).toBe('Keep me')
    expect(field<HTMLButtonElement>('subject-form-submit').disabled).toBe(false)
  })

  it('does not create the subject twice when only the milestone failed', async () => {
    send.mockImplementation((path: string) => {
      if (path === '/api/events') {
        return Promise.reject(new Error('Event refused'))
      }
      return Promise.resolve({ id: 9 })
    })
    const dialog = await mounted()
    await type('subject-form-title', 'Migration')
    await type('subject-form-milestone', '2026-10-01')
    await submit()
    expect(field('subject-form-refusal').textContent).toContain('Event refused')
    send.mockResolvedValue({})
    await submit()
    const creations = send.mock.calls.filter(([path]) => path === '/api/epics')
    expect(creations).toHaveLength(1)
    expect(dialog.emitted('saved')).toEqual([[9]])
  })

  it('creates a tag from the form with its colour and selects it', async () => {
    send.mockResolvedValue({ id: 8, label: 'ops', colour: '#123456', usage: 0 })
    const dialog = await mounted()
    await type('form-tag-label', '#ops')
    await type('form-tag-colour', '#123456')
    field<HTMLButtonElement>('form-tag-add').click()
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/tags', 'POST', { label: 'ops', colour: '#123456' })
    expect(field('form-tag-8').getAttribute('aria-pressed')).toBe('true')
    expect(dialog.emitted('changed')).toHaveLength(1)
  })

  it('selects an existing tag instead of creating it twice', async () => {
    await mounted()
    await type('form-tag-label', 'URGENT')
    field<HTMLButtonElement>('form-tag-add').click()
    await flushPromises()
    expect(send).not.toHaveBeenCalled()
    expect(field('form-tag-7').getAttribute('aria-pressed')).toBe('true')
  })

  it('adds and removes a dependency', async () => {
    await mounted()
    await type('form-dependency-select', '11')
    field<HTMLButtonElement>('form-dependency-add').click()
    await flushPromises()
    expect(field('form-dependencies').textContent).toContain('Invoices')
    document.body.querySelector<HTMLButtonElement>('[aria-label="Remove the dependency Invoices"]')!.click()
    await flushPromises()
    expect(field('form-dependencies').textContent).not.toContain('Invoices')
  })
})

describe('Escape', () => {
  function pressEscape(target: Element): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  }

  it('closes the list of projects first and the dialog on the next press', async () => {
    const dialog = await mounted()
    const combo = field<HTMLInputElement>('subject-form-project')
    combo.focus()
    combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(combo.getAttribute('aria-expanded')).toBe('true')
    pressEscape(combo)
    await flushPromises()
    expect(combo.getAttribute('aria-expanded')).toBe('false')
    expect(dialog.emitted('close')).toBeUndefined()
    pressEscape(combo)
    await flushPromises()
    expect(dialog.emitted('close')).toHaveLength(1)
  })

  it('closes only the small project form when it sits on top of the subject form', async () => {
    const dialog = await mounted()
    const combo = field<HTMLInputElement>('subject-form-project')
    combo.focus()
    combo.value = 'Brand new'
    combo.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()
    const small = field('new-project-name')
    expect(small).not.toBeNull()
    pressEscape(small)
    await flushPromises()
    expect(document.body.querySelector('[data-test-id="new-project-dialog"]')).toBeNull()
    expect(document.body.querySelector('[data-test-id="subject-form-dialog"]')).not.toBeNull()
    expect(dialog.emitted('close')).toBeUndefined()
  })
})

describe('editing a subject', () => {
  const subject = epic({
    assignee: 'anna',
    state: 'doing',
    priority: 'high',
    requestedBy: 'Anthony',
    startedOn: '2026-09-01',
    statusNote: 'Going well',
    dueOn: '2026-10-01',
    tags: [{ id: 7, label: 'urgent', colour: '#ff0000', usage: 1 }],
    links: [{ kind: 'doc', url: 'https://example.com/doc' }],
    dependsOn: [10],
  })

  beforeEach(() => {
    read.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/projects/1/events'
          ? [{ id: 55, type: 'production', date: '2026-10-01', title: 'Go', projectId: 1, epicId: 4, note: null, minutes: null, minutesUpdatedAt: null }]
          : [],
      ),
    )
  })

  it('prefills every field, locks the project and shows the milestone', async () => {
    await mounted({ subject })
    await flushPromises()
    expect(field<HTMLInputElement>('subject-form-title').value).toBe('Cloudmail')
    expect(field<HTMLSelectElement>('subject-form-owner').value).toBe('anna')
    expect(field<HTMLSelectElement>('subject-form-priority').value).toBe('high')
    expect(field<HTMLInputElement>('subject-form-requested-by').value).toBe('Anthony')
    expect(field<HTMLInputElement>('subject-form-start').value).toBe('2026-09-01')
    expect(field<HTMLInputElement>('subject-form-milestone').value).toBe('2026-10-01')
    expect(field<HTMLTextAreaElement>('subject-form-note').value).toBe('Going well')
    expect(field('form-tag-7').getAttribute('aria-pressed')).toBe('true')
    expect(field<HTMLInputElement>('form-link-url').value).toBe('https://example.com/doc')
    expect(field('form-dependencies').textContent).toContain('Billing')
    expect(field<HTMLInputElement>('subject-form-project').disabled).toBe(true)
    expect(field('subject-form-submit').textContent).toContain('Save')
  })

  it('saves the changes, the new owner and the moved milestone', async () => {
    const dialog = await mounted({ subject })
    await flushPromises()
    await type('subject-form-owner', '')
    await type('subject-form-milestone', '2026-10-15')
    await type('subject-form-title', 'Cloudmail v2')
    await submit()
    expect(send).toHaveBeenCalledWith('/api/epics/4/assignee', 'PUT', { login: null })
    expect(send).toHaveBeenCalledWith(
      '/api/epics/4',
      'PATCH',
      expect.objectContaining({ priority: 'high', tagIds: [7], dependsOn: [10], state: 'todo' }),
    )
    expect(send).toHaveBeenCalledWith('/api/events/55', 'PATCH', { date: '2026-10-15' })
    expect(dialog.emitted('saved')).toEqual([[4]])
  })

  it('removes the milestone when the date is cleared', async () => {
    await mounted({ subject })
    await flushPromises()
    await type('subject-form-milestone', '')
    await submit()
    expect(send).toHaveBeenCalledWith('/api/events/55', 'DELETE')
  })
})
