import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { createBoardI18n } from '@/technical/Language/I18n'
import ProjectsSection from '@/domain/Setting/ProjectsSection.vue'
import TagsSection from '@/domain/Setting/TagsSection.vue'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import UsersSection from '@/domain/Setting/UsersSection.vue'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

const SHEETS = [
  {
    id: 1,
    slug: 'alpha',
    name: 'Alpha',
    colour: '#112233',
    position: 0,
    adminUserId: 4,
    adminLogin: 'ana',
    adminName: 'Ana',
    links: [{ kind: 'repo', url: 'https://example.com/alpha' }],
    usage: 3,
  },
  {
    id: 2,
    slug: 'beta',
    name: 'Beta',
    colour: '#445566',
    position: 1,
    adminUserId: null,
    adminLogin: null,
    adminName: null,
    links: [],
    usage: 0,
  },
]

const USERS = [
  { id: 4, login: 'ana', displayName: 'Ana Lys', role: 'architect', superAdmin: false, active: true, capacity: 3 },
  { id: 5, login: 'bob', displayName: 'Bob', role: 'architect', superAdmin: false, active: false, capacity: null },
]

const TAGS = [
  { id: 1, label: 'urgent', colour: '#ff0000', usage: 2 },
  { id: 2, label: 'later', colour: '#00ff00', usage: 0 },
]

const WORKFLOW_OF_ALPHA = {
  columns: [
    { id: 1, projectId: 1, key: 'spec', label: 'Spec', colour: '#7C3AED', position: 1, provider: 'claude', model: 'claude-opus-5-5', effort: 'high', agentName: '', command: '', preprompt: '', autoStart: true, behaviouralKind: 'ordinary' },
  ],
  maySettle: true,
  admin: { login: 'ana', name: 'Ana' },
}

const WORKFLOW_OF_BETA = { columns: [], maySettle: false, admin: null }

const ROUTES: Record<string, unknown> = {
  '/api/projects/1/workflow-columns': WORKFLOW_OF_ALPHA,
  '/api/projects/2/workflow-columns': WORKFLOW_OF_BETA,
  '/api/projects/sheets': SHEETS,
  '/api/board-users': USERS,
  '/api/tags': TAGS,
}

const STUBS = { RouterLink: { template: '<a><slot /></a>' }, ProjectCreateForm: true }

function mountWith(component: Component, props: Record<string, unknown> = {}) {
  const options = { props, global: { plugins: [createBoardI18n('en')], stubs: STUBS } }
  return mount(component, options as never)
}

beforeEach(() => {
  read.mockReset()
  send.mockReset()
  send.mockResolvedValue({})
  read.mockImplementation((path: string) => Promise.resolve(ROUTES[path] ?? []))
})

describe('ProjectsSection', () => {
  const self = { login: 'ana', superAdmin: false }

  it('disables the delete button of a used project and says why', async () => {
    const section = mountWith(ProjectsSection, { self })
    await flushPromises()

    const rows = section.findAll('li.rounded-md')
    const alpha = rows[0]
    const remove = alpha?.findAll('button').find((button) => button.text().startsWith('Delete'))
    expect(remove?.attributes('disabled')).toBeDefined()
    expect(alpha?.text()).toContain('used by 3 subjects')
    const beta = rows[1]?.findAll('button').find((button) => button.text().startsWith('Delete'))
    expect(beta?.attributes('disabled')).toBeUndefined()
  })

  it('deletes an unused project', async () => {
    const section = mountWith(ProjectsSection, { self })
    await flushPromises()

    const beta = section.findAll('li.rounded-md').filter((row) => row.text().includes('Delete'))[1]
    await beta?.findAll('button').find((button) => button.text().startsWith('Delete'))?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/2', 'DELETE', undefined)
  })

  it('moves a project down with the order the server keeps', async () => {
    const section = mountWith(ProjectsSection, { self })
    await flushPromises()

    await section.find('button[aria-label="Move Alpha down"]').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/1', 'PUT', { position: 1 })
  })

  it('locks the admin select for anyone but the admin, and on a project with no admin for anyone but a director or a super admin', async () => {
    const section = mountWith(ProjectsSection, {
      self: { login: 'bob', superAdmin: false },
    })
    await flushPromises()

    const selects = section.findAll('select').filter((select) => select.text().includes('No admin'))
    expect(selects[0]?.attributes('disabled')).toBeDefined()
    expect(selects[1]?.attributes('disabled')).toBeDefined()
  })

  it('offers the workflow settings only where the project says the caller may settle', async () => {
    const section = mountWith(ProjectsSection, { self })
    await flushPromises()

    const gears = section.findAll('button').filter((button) => button.text().includes('Workflow settings'))
    expect(gears).toHaveLength(1)
    expect(gears[0]?.text()).toContain('1 step')
    expect(gears[0]?.attributes('aria-label')).toBe('Workflow settings of Alpha')
  })

  it('tells a member who set the workflow, and shows no gear', async () => {
    read.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/projects/1/workflow-columns'
          ? { ...WORKFLOW_OF_ALPHA, maySettle: false }
          : (ROUTES[path] ?? []),
      ),
    )
    const section = mountWith(ProjectsSection, { self: { login: 'bob', superAdmin: false } })
    await flushPromises()

    expect(section.text()).toContain('Workflow set by Ana')
    expect(section.findAll('button').filter((button) => button.text().includes('Workflow settings'))).toHaveLength(0)
  })

  it('sends the new admin', async () => {
    const section = mountWith(ProjectsSection, { self: { login: 'ana', superAdmin: false, director: true } })
    await flushPromises()

    const select = section.findAll('select').filter((element) => element.text().includes('No admin'))[1]
    await select?.setValue('4')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/2', 'PUT', { adminId: 4 })
  })

  it('adds a link to a project', async () => {
    const section = mountWith(ProjectsSection, { self })
    await flushPromises()

    await section.find('#link-url-2').setValue('https://example.com/beta')
    await section.findAll('form').find((form) => form.find('#link-url-2').exists())?.trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/2', 'PUT', {
      links: [{ kind: 'repo', url: 'https://example.com/beta' }],
    })
  })
})

describe('TagsSection', () => {
  it('disables the delete button of a used tag and keeps the other one', async () => {
    const section = mountWith(TagsSection)
    await flushPromises()

    const buttons = section.findAll('button').filter((button) => button.text().startsWith('Delete'))
    expect(buttons[0]?.attributes('disabled')).toBeDefined()
    expect(buttons[1]?.attributes('disabled')).toBeUndefined()
    expect(section.text()).toContain('used by 2 subjects')
  })

  it('creates a tag', async () => {
    const section = mountWith(TagsSection)
    await flushPromises()

    await section.find('#new-tag-label').setValue('  fresh ')
    await section.find('form').trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/tags', 'POST', { label: 'fresh', colour: '#e08a00' })
  })
})

describe('UsersSection', () => {
  const self = { login: 'root', superAdmin: true }

  it('shows an inactive account as such and offers to reactivate it', async () => {
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()

    expect(section.text()).toContain('Inactive')
    await section.findAll('button').find((button) => button.text().startsWith('Reactivate'))?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/board-users/bob', 'PATCH', { active: true })
  })

  it('deactivates an active account', async () => {
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()

    await section.findAll('button').find((button) => button.text().startsWith('Deactivate'))?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/board-users/ana', 'PATCH', { active: false })
  })

  it('saves a capacity, and clears it with an empty field', async () => {
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()
    const input = section.find('input[aria-label="Capacity of Ana Lys, in subjects in progress"]')

    await input.setValue('5')
    await input.setValue('')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/board-users/ana', 'PATCH', { capacity: 5 })
    expect(send).toHaveBeenCalledWith('/api/board-users/ana', 'PATCH', { capacity: null })
  })

  it('refuses a capacity out of range without calling the board', async () => {
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()

    await section.find('input[aria-label="Capacity of Ana Lys, in subjects in progress"]').setValue('500')
    await flushPromises()

    expect(send).not.toHaveBeenCalled()
    expect(section.find('[role="alert"]').text()).toContain('whole number from 1 to 99')
  })

  it('offers a super admin to grant the flag and to remove it', async () => {
    read.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/board-users' ? [{ ...USERS[0], superAdmin: true }, USERS[1]] : []),
    )
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()

    const remove = section.find('button[aria-label="Remove super admin: Ana Lys"]')
    const grant = section.find('button[aria-label="Make super admin: Bob"]')
    expect(remove.exists()).toBe(true)
    await grant.trigger('click')
    await remove.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/board-users/bob', 'PATCH', { superAdmin: true })
    expect(send).toHaveBeenCalledWith('/api/board-users/ana', 'PATCH', { superAdmin: false })
  })

  it('shows the refusal when removing the last super admin', async () => {
    read.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/board-users' ? [{ ...USERS[0], superAdmin: true }] : []),
    )
    send.mockRejectedValue(new BoardRequestError(409, 'LastSuperAdminError', 'last'))
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()

    await section.find('button[aria-label="Remove super admin: Ana Lys"]').trigger('click')
    await flushPromises()

    expect(section.find('[role="alert"]').text()).toContain('The last super admin cannot be removed.')
  })

  it('hides the super admin control from a director who is not a super admin', async () => {
    const section = mountWith(UsersSection, { self: { login: 'dan', superAdmin: false }, manages: true })
    await flushPromises()

    expect(section.find('button[aria-label^="Make super admin"]').exists()).toBe(false)
    expect(section.find('button[aria-label^="Remove super admin"]').exists()).toBe(false)
  })

  it('hides the account management from someone who does not manage', async () => {
    const section = mountWith(UsersSection, { self: { login: 'ana', superAdmin: false }, manages: false })
    await flushPromises()

    expect(section.findAll('button').filter((button) => /activate/i.test(button.text()))).toHaveLength(0)
    expect(section.find('form').exists()).toBe(false)
  })

  it('adds an account', async () => {
    const section = mountWith(UsersSection, { self, manages: true })
    await flushPromises()

    const fields = section.findAll('form input')
    await fields[0]?.setValue('eve')
    await fields[1]?.setValue('Eve')
    await fields[2]?.setValue('a very long password')
    await section.find('form').trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/board-users', 'POST', {
      login: 'eve',
      displayName: 'Eve',
      password: 'a very long password',
      role: 'architect',
    })
  })
})
