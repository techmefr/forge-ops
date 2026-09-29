import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import SubjectsScreen from '@/domain/Subject/SubjectsScreen.vue'
import type { EpicOverview } from '@contract/StoryContract'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

const PROJECTS = [
  { id: 1, slug: 'skera', name: 'Skera', repositoryUrl: 'u', integrationBranch: 'main', colour: '#ff3b00', checkoutPath: null },
  { id: 2, slug: 'forge', name: 'Forge', repositoryUrl: 'u', integrationBranch: 'main', colour: 'acc', checkoutPath: null },
]

const USERS = [
  { id: 1, login: 'anna', displayName: 'Anna Martin', role: 'architect', superAdmin: false, active: true, capacity: 2 },
  { id: 2, login: 'bob', displayName: 'Bob Stone', role: 'architect', superAdmin: false, active: true, capacity: null },
  { id: 3, login: 'old', displayName: 'Old Timer', role: 'architect', superAdmin: false, active: false, capacity: 3 },
]

let next = 1

function epic(over: Partial<EpicOverview> = {}): EpicOverview {
  const id = next++
  return {
    id,
    projectId: 1,
    title: `Subject ${id}`,
    businessIntent: 'Because',
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

function followUp(projectId: number) {
  return {
    projectId,
    statusSentence: null,
    weather: 'sunny',
    source: 'computed',
    score: { late: 0, blocked: 0, highRisks: 0, total: 0 },
    alerts: { late: 0, blocked: 0, highRisks: 0, minutesToWrite: 0 },
    nextEvent: null,
    risks: [],
    decisions: [],
    events: [],
  }
}

type World = {
  live: EpicOverview[]
  trash?: EpicOverview[]
  users?: unknown[]
  self?: string
}

function serve(world: World): void {
  const responses: Record<string, unknown> = {
    '/api/epics': world.live,
    '/api/epics?state=trash': world.trash ?? [],
    '/api/projects': PROJECTS,
    '/api/projects/1/follow-up': followUp(1),
    '/api/projects/2/follow-up': followUp(2),
    '/api/tags': [{ id: 7, label: 'Urgent', colour: '#ff0000', usage: 1 }],
    '/api/board-users': world.users ?? USERS,
    '/api/board/self': { login: world.self ?? 'anna', superAdmin: false },
  }
  read.mockImplementation((path: string) => Promise.resolve(responses[path] ?? []))
}

async function mounted(language: 'en' | 'fr' = 'en'): Promise<VueWrapper> {
  const screen = mount(SubjectsScreen, {
    attachTo: document.body,
    global: { plugins: [createBoardI18n(language)] },
  })
  await flushPromises()
  return screen
}

function titlesOf(screen: VueWrapper): string[] {
  return screen.findAll('[data-test-id="subject-open"]').map((button) => button.text())
}

beforeEach(() => {
  next = 1
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 29, 10, 0))
  read.mockReset()
  send.mockReset()
  send.mockResolvedValue({})
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('SubjectsScreen people', () => {
  it('lists the active members with their load, and opens on the signed-in person', async () => {
    serve({
      live: [
        epic({ assignee: 'anna', state: 'doing', title: 'Mine' }),
        epic({ assignee: 'bob', state: 'doing', title: 'His' }),
      ],
    })
    const screen = await mounted()
    expect(screen.find('[data-test-id="person-anna"]').exists()).toBe(true)
    expect(screen.find('[data-test-id="person-bob"]').exists()).toBe(true)
    expect(screen.find('[data-test-id="person-old"]').exists()).toBe(false)
    expect(screen.find('[data-test-id="list-title"]').text()).toBe('Anna Martin')
    expect(titlesOf(screen)).toEqual(['Mine'])
  })

  it('shows the load as in progress over capacity, neutral under, orange at, red above', async () => {
    serve({
      live: [
        epic({ assignee: 'anna', state: 'doing' }),
        epic({ assignee: 'anna', state: 'blocked' }),
        epic({ assignee: 'anna', state: 'doing' }),
      ],
    })
    const screen = await mounted()
    const chip = screen.find('[data-test-id="person-anna"] [data-test-id="load-chip"]')
    expect(chip.text()).toContain('3/2')
    expect(chip.attributes('data-tone')).toBe('over')
    expect(chip.text()).toContain('over capacity')
  })

  it('is orange at capacity and neutral under it', async () => {
    serve({ live: [epic({ assignee: 'anna', state: 'doing' }), epic({ assignee: 'anna', state: 'doing' })] })
    const at = (await mounted()).find('[data-test-id="person-anna"] [data-test-id="load-chip"]')
    expect(at.attributes('data-tone')).toBe('full')
    expect(at.text()).toContain('at capacity')
    document.body.innerHTML = ''
    serve({ live: [epic({ assignee: 'anna', state: 'doing' })] })
    const under = (await mounted()).find('[data-test-id="person-anna"] [data-test-id="load-chip"]')
    expect(under.attributes('data-tone')).toBe('neutral')
  })

  it('shows the count alone for a person without capacity', async () => {
    serve({ live: [epic({ assignee: 'bob', state: 'doing' }), epic({ assignee: 'bob', state: 'doing' })] })
    const chip = (await mounted()).find('[data-test-id="person-bob"] [data-test-id="load-chip"]')
    expect(chip.find('[aria-hidden="true"]').text()).toBe('2')
    expect(chip.attributes('data-tone')).toBe('neutral')
  })

  it('flags late and blocked subjects under the name', async () => {
    serve({
      live: [
        epic({ assignee: 'anna', state: 'doing', lateDays: 4 }),
        epic({ assignee: 'anna', state: 'blocked' }),
        epic({ assignee: 'anna', state: 'blocked' }),
      ],
    })
    const person = (await mounted()).find('[data-test-id="person-anna"]')
    expect(person.find('[data-test-id="flag-late"]').text()).toBe('1 late')
    expect(person.find('[data-test-id="flag-blocked"]').text()).toBe('2 blocked')
  })

  it('lists people found on subjects even when no account exists for them', async () => {
    serve({ live: [epic({ assignee: 'local', state: 'doing' })], users: [], self: 'local' })
    const screen = await mounted()
    expect(screen.find('[data-test-id="person-local"]').exists()).toBe(true)
    expect(screen.find('[data-test-id="list-title"]').text()).toBe('local')
  })
})

describe('SubjectsScreen counts and lists', () => {
  const world = (): World => ({
    live: [
      epic({ title: 'Late one', assignee: 'bob', state: 'doing', lateDays: 3 }),
      epic({ title: 'Free late', state: 'todo', lateDays: 8 }),
      epic({ title: 'Free', state: 'todo' }),
      epic({ title: 'Blocked', assignee: 'anna', state: 'blocked', storyCount: 1, blockedSince: '2026-09-25T08:00:00.000Z' }),
      epic({ title: 'Shipped', assignee: 'anna', state: 'done' }),
    ],
    trash: [epic({ title: 'Gone', state: 'trash', deletedAt: '2026-09-01T10:00:00.000Z' })],
  })

  it('shows counts next to the views that match the lists they open', async () => {
    serve(world())
    const screen = await mounted()
    for (const [view, counter] of [
      ['view-all', 'count-all'],
      ['view-late', 'count-late'],
      ['view-none', 'count-none'],
    ] as const) {
      const shown = Number(screen.find(`[data-test-id="${counter}"]`).text())
      await screen.find(`[data-test-id="${view}"]`).trigger('click')
      expect(screen.findAll('[data-test-id="subject-open"]'), view).toHaveLength(shown)
    }
  })

  it('sorts the late subjects first, most late on top', async () => {
    serve(world())
    const screen = await mounted()
    await screen.find('[data-test-id="view-all"]').trigger('click')
    expect(titlesOf(screen).slice(0, 2)).toEqual(['Free late', 'Late one'])
  })

  it('offers the state filters with their counts and filters the list', async () => {
    serve(world())
    const screen = await mounted()
    await screen.find('[data-test-id="view-all"]').trigger('click')
    expect(screen.find('[data-test-id="filter-done"]').text()).toContain('1')
    expect(screen.find('[data-test-id="filter-trash"]').text()).toContain('1')
    await screen.find('[data-test-id="filter-done"]').trigger('click')
    expect(titlesOf(screen)).toEqual(['Shipped'])
    await screen.find('[data-test-id="filter-blocked"]').trigger('click')
    expect(titlesOf(screen)).toEqual(['Blocked'])
  })

  it('shows the deleted subjects with a Restore button that restores them', async () => {
    serve(world())
    const screen = await mounted()
    await screen.find('[data-test-id="view-all"]').trigger('click')
    await screen.find('[data-test-id="filter-trash"]').trigger('click')
    expect(titlesOf(screen)).toEqual(['Gone'])
    expect(screen.find('[data-test-id="subject-take"]').exists()).toBe(false)
    await screen.find('[data-test-id="subject-restore"]').trigger('click')
    expect(send).toHaveBeenCalledWith('/api/epics/6/restore', 'POST')
  })

  it('says how long a subject has been blocked and what it waits on', async () => {
    serve({
      live: [
        epic({
          assignee: 'anna',
          state: 'blocked',
          blockedSince: '2026-09-25T08:00:00.000Z',
          waitingOn: [{ id: 99, title: 'Billing' }],
        }),
      ],
    })
    const screen = await mounted()
    expect(screen.find('[data-test-id="subject-blocked"]').text()).toBe('Blocked for 4 d')
    expect(screen.find('[data-test-id="subject-waiting"]').text()).toBe('Waiting on Billing')
  })

  it('badges the due date as D+x when late and D-x when ahead', async () => {
    serve({
      live: [
        epic({ assignee: 'anna', state: 'doing', dueOn: '2026-09-26', lateDays: 3, title: 'Behind' }),
        epic({ assignee: 'anna', state: 'doing', dueOn: '2026-10-20', title: 'Ahead' }),
      ],
    })
    const badges = (await mounted()).findAll('[data-test-id="subject-due"]').map((badge) => badge.text())
    expect(badges[0]).toContain('D+3')
    expect(badges[1]).toContain('D-21')
  })

  it('narrows by search, tag and project', async () => {
    serve({
      live: [
        epic({ title: 'Cloudmail', projectId: 1, tags: [{ id: 7, label: 'Urgent', colour: '#f00', usage: 1 }] }),
        epic({ title: 'Billing', projectId: 2 }),
      ],
    })
    const screen = await mounted()
    await screen.find('[data-test-id="view-all"]').trigger('click')
    expect(titlesOf(screen)).toHaveLength(2)
    await screen.find('[data-test-id="subjects-search"]').setValue('bill')
    expect(titlesOf(screen)).toEqual(['Billing'])
    await screen.find('[data-test-id="subjects-search"]').setValue('')
    await screen.find('[data-test-id="subjects-tag"]').setValue('7')
    expect(titlesOf(screen)).toEqual(['Cloudmail'])
    await screen.find('[data-test-id="subjects-tag"]').setValue('all')
    await screen.find('[data-test-id="subjects-project"]').setValue('2')
    expect(titlesOf(screen)).toEqual(['Billing'])
    expect(window.localStorage.getItem('forge.subjects.project')).toBe('2')
  })
})

describe('SubjectsScreen actions', () => {
  it('takes a subject through the claim route and starts it', async () => {
    serve({ live: [epic({ title: 'Free' })] })
    const screen = await mounted()
    await screen.find('[data-test-id="view-none"]').trigger('click')
    await screen.find('[data-test-id="subject-take"]').trigger('click')
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/epics/1/claim', 'POST')
    expect(send).toHaveBeenCalledWith('/api/epics/1', 'PATCH', { state: 'doing' })
  })

  it('does not touch the state of a subject whose state comes from its stories', async () => {
    serve({ live: [epic({ title: 'Staffed', storyCount: 2 })] })
    const screen = await mounted()
    await screen.find('[data-test-id="view-none"]').trigger('click')
    await screen.find('[data-test-id="subject-take"]').trigger('click')
    await flushPromises()
    expect(send).toHaveBeenCalledTimes(1)
    expect(screen.find('[data-test-id="subject-state"]').exists()).toBe(false)
  })

  it('releases only the subjects of the signed-in person', async () => {
    serve({
      live: [
        epic({ title: 'Mine', assignee: 'anna', state: 'doing' }),
        epic({ title: 'His', assignee: 'bob', state: 'doing' }),
      ],
    })
    const screen = await mounted()
    await screen.find('[data-test-id="subject-release"]').trigger('click')
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/epics/1/claim', 'DELETE')
    expect(send).toHaveBeenCalledWith('/api/epics/1', 'PATCH', { state: 'todo' })
    await screen.find('[data-test-id="person-bob"]').trigger('click')
    expect(screen.find('[data-test-id="subject-release"]').exists()).toBe(false)
  })

  it('changes the state of a subject from its row', async () => {
    serve({ live: [epic({ assignee: 'anna', state: 'doing' })] })
    const screen = await mounted()
    await screen.find('[data-test-id="subject-state"]').setValue('blocked')
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/epics/1', 'PATCH', { state: 'blocked' })
  })

  it('shows the refusal of the board when an action fails', async () => {
    serve({ live: [epic({ assignee: 'anna', state: 'doing' })] })
    send.mockRejectedValueOnce(new Error('Already taken'))
    const screen = await mounted()
    await screen.find('[data-test-id="subject-release"]').trigger('click')
    await flushPromises()
    expect(screen.find('[data-test-id="subjects-refusal"]').text()).toContain('Already taken')
  })

  it('creates a subject from the toolbar', async () => {
    serve({ live: [] })
    send.mockResolvedValue({ id: 9 })
    const screen = await mounted()
    await screen.find('[data-test-id="subjects-new"]').trigger('click')
    await flushPromises()
    const title = document.body.querySelector<HTMLInputElement>('[data-test-id="new-subject-title"]')
    const intent = document.body.querySelector<HTMLTextAreaElement>('[data-test-id="new-subject-intent"]')
    expect(title).not.toBeNull()
    title!.value = 'Cloudmail'
    title!.dispatchEvent(new Event('input'))
    intent!.value = 'Mail'
    intent!.dispatchEvent(new Event('input'))
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-test-id="new-subject-create"]')!.click()
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/epics', 'POST', {
      projectId: 1,
      title: 'Cloudmail',
      businessIntent: 'Mail',
    })
  })
})

describe('SubjectsScreen keyboard', () => {
  it('moves from one person to the next with the arrows and keeps the focus in the list', async () => {
    serve({ live: [epic({ assignee: 'anna', state: 'doing' })] })
    const screen = await mounted()
    const anna = screen.find('[data-test-id="person-anna"]')
    ;(anna.element as HTMLElement).focus()
    await anna.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(screen.find('[data-test-id="list-title"]').text()).toBe('Bob Stone')
    expect(document.activeElement).toBe(screen.find('[data-test-id="person-bob"]').element)
    await screen.find('[data-test-id="person-bob"]').trigger('keydown', { key: 'ArrowUp' })
    await flushPromises()
    expect(document.activeElement).toBe(screen.find('[data-test-id="person-anna"]').element)
  })

  it('wraps from the last person to the first view', async () => {
    serve({ live: [] , self: 'bob'})
    const screen = await mounted()
    await screen.find('[data-test-id="person-bob"]').trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(screen.find('[data-test-id="list-title"]').text()).toBe('All subjects')
  })

  it('marks the selection and gives the tab stop to it alone', async () => {
    serve({ live: [] })
    const screen = await mounted()
    expect(screen.find('[data-test-id="person-anna"]').attributes('aria-current')).toBe('true')
    expect(screen.find('[data-test-id="person-anna"]').attributes('tabindex')).toBe('0')
    expect(screen.find('[data-test-id="person-bob"]').attributes('tabindex')).toBe('-1')
  })

  it('remembers the person you were on', async () => {
    serve({ live: [] })
    const first = await mounted()
    await first.find('[data-test-id="person-bob"]').trigger('click')
    document.body.innerHTML = ''
    const second = await mounted()
    expect(second.find('[data-test-id="list-title"]').text()).toBe('Bob Stone')
  })
})

describe('SubjectsScreen drawer', () => {
  const history = [
    { state: 'todo', at: '2026-09-01T08:00:00.000Z', by: 'system' },
    { state: 'doing', at: '2026-09-10T08:00:00.000Z', by: 'anna' },
  ]

  function serveDrawer(): void {
    const subject = epic({ title: 'Cloudmail', assignee: 'anna', state: 'doing', statusNote: 'On track' })
    const responses: Record<string, unknown> = {
      '/api/epics': [subject],
      '/api/epics?state=trash': [],
      '/api/projects': PROJECTS,
      '/api/projects/1/follow-up': followUp(1),
      '/api/projects/2/follow-up': followUp(2),
      '/api/tags': [],
      '/api/board-users': USERS,
      '/api/board/self': { login: 'anna', superAdmin: false },
      '/api/epics/1/history': history,
      '/api/projects/1/events': [],
      '/api/projects/1/links': [{ kind: 'repo', url: 'https://example.com/repo' }],
    }
    read.mockImplementation((path: string) => Promise.resolve(responses[path] ?? []))
  }

  it('opens on a row click and shows the state history and the project links', async () => {
    serveDrawer()
    const screen = await mounted()
    await screen.find('[data-test-id="subject-row-1"]').trigger('click')
    await flushPromises()
    const drawer = document.body.querySelector('[data-test-id="subject-drawer"]')
    expect(drawer).not.toBeNull()
    expect(drawer?.textContent).toContain('Cloudmail')
    expect(document.body.querySelector<HTMLTextAreaElement>('#drawer-note')?.value).toBe('On track')
    expect(document.body.querySelectorAll('[data-test-id="subject-history"] li')).toHaveLength(2)
    expect(drawer?.textContent).toContain('Repository')
  })

  it('opens from the keyboard through the title button', async () => {
    serveDrawer()
    const screen = await mounted()
    await screen.find('[data-test-id="subject-open"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-test-id="subject-drawer"]')).not.toBeNull()
  })

  it('does not open when the click was on the take or state controls', async () => {
    serveDrawer()
    const screen = await mounted()
    await screen.find('[data-test-id="subject-state"]').trigger('click')
    expect(document.body.querySelector('[data-test-id="subject-drawer"]')).toBeNull()
  })

  it('closes with its Close button', async () => {
    serveDrawer()
    const screen = await mounted()
    await screen.find('[data-test-id="subject-open"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-test-id="drawer-close"]')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-test-id="subject-drawer"]')).toBeNull()
  })

  it('saves the quick summary in place', async () => {
    serveDrawer()
    const screen = await mounted()
    await screen.find('[data-test-id="subject-open"]').trigger('click')
    await flushPromises()
    const note = document.body.querySelector<HTMLTextAreaElement>('#drawer-note')!
    note.value = 'Late by a day'
    note.dispatchEvent(new Event('input'))
    note.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/epics/1', 'PATCH', { statusNote: 'Late by a day' })
  })

  it('deletes only after a second confirming click', async () => {
    serveDrawer()
    const screen = await mounted()
    await screen.find('[data-test-id="subject-open"]').trigger('click')
    await flushPromises()
    const remove = document.body.querySelector<HTMLButtonElement>('[data-test-id="drawer-delete"]')!
    remove.click()
    await flushPromises()
    expect(send).not.toHaveBeenCalled()
    remove.click()
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/epics/1', 'DELETE')
  })
})

describe('SubjectsScreen in French', () => {
  it('speaks French', async () => {
    serve({ live: [] })
    const screen = await mounted('fr')
    expect(screen.text()).toContain('Tous les sujets')
    expect(screen.text()).toContain('Non attribués')
  })
})
