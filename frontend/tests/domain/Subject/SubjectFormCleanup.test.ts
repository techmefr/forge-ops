import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import SubjectFormDialog from '@/domain/Subject/SubjectFormDialog.vue'
import type { Project } from '@contract/StoryContract'

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
]

async function mounted(): Promise<VueWrapper> {
  const wrapper = mount(SubjectFormDialog, {
    attachTo: document.body,
    props: { subject: null, projects: PROJECTS, projectId: 1, people: [], tags: [], subjects: [] },
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

async function makeTag(): Promise<void> {
  await type('form-tag-label', 'ops')
  field<HTMLButtonElement>('form-tag-add').click()
  await flushPromises()
}

beforeEach(() => {
  read.mockReset()
  read.mockResolvedValue([])
  send.mockReset()
  send.mockImplementation((path: string) => {
    if (path === '/api/tags') {
      return Promise.resolve({ id: 8, label: 'ops', colour: '#0f9d8a', usage: 0 })
    }
    if (path === '/api/epics') {
      return Promise.resolve({ id: 9 })
    }
    if (path === '/api/events') {
      return Promise.resolve({ id: 31 })
    }
    return Promise.resolve({})
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('a tag made in the form', () => {
  it('is removed again when the form is cancelled', async () => {
    const dialog = await mounted()
    await makeTag()

    field<HTMLButtonElement>('subject-form-cancel').click()
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/tags/8', 'DELETE')
    expect(dialog.emitted('close')).toHaveLength(1)
  })

  it('stays when the subject was saved with it', async () => {
    await mounted()
    await makeTag()
    await type('subject-form-title', 'Migration')
    field<HTMLButtonElement>('subject-form-submit').click()
    await flushPromises()

    field<HTMLButtonElement>('subject-form-cancel').click()
    await flushPromises()

    expect(send).not.toHaveBeenCalledWith('/api/tags/8', 'DELETE')
  })
})

describe('the milestone of a subject saved after a failure', () => {
  it('moves the event that was created instead of an unknown one when saved again', async () => {
    send.mockImplementation((path: string, method: string) => {
      if (path === '/api/epics') {
        return Promise.resolve({ id: 9 })
      }
      if (path === '/api/events' && method === 'POST') {
        return Promise.resolve({ id: 31 })
      }
      return Promise.resolve({})
    })
    await mounted()
    await type('subject-form-title', 'Migration')
    await type('subject-form-milestone', '2026-10-01')
    field<HTMLButtonElement>('subject-form-submit').click()
    await flushPromises()

    await type('subject-form-milestone', '2026-10-05')
    field<HTMLButtonElement>('subject-form-submit').click()
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/events/31', 'PATCH', { date: '2026-10-05' })
  })
})
