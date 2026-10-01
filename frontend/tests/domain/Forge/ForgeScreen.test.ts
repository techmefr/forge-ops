import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { routerKey } from 'vue-router'
import type { ForgeCardStatus, ForgeCardView } from '@contract/ForgeCardContract'
import type { StoryThread } from '@contract/ConversationContract'
import type { ProjectWorkflow, WorkflowColumn } from '@contract/WorkflowColumnContract'
import { createBoardI18n } from '@/technical/Language/I18n'
import type { StreamedEvent } from '@/technical/Api/BoardStream'
import ForgeScreen from '@/domain/Forge/ForgeScreen.vue'
import { FORGE_VIEW_KEY } from '@/domain/Forge/ForgeRule'

const read = vi.fn()
const send = vi.fn()
const push = vi.fn()
let streamed: ((event: StreamedEvent) => void) | null = null

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

vi.mock('@/technical/Api/BoardStream', () => ({
  openBoardStream: (input: { onEvent: (event: StreamedEvent) => void }) => {
    streamed = input.onEvent
    return { close: () => undefined }
  },
}))

function column(id: number, key: string, overrides: Partial<WorkflowColumn> = {}): WorkflowColumn {
  return {
    id,
    projectId: 1,
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    colour: 'acc',
    position: id,
    provider: 'claude',
    model: 'claude-sonnet-5',
    effort: 'high',
    agentName: '',
    command: '/speckit.plan',
    preprompt: '',
    autoStart: false,
    behaviouralKind: 'ordinary',
    ...overrides,
  }
}

function card(id: number, stepKey: string, status: ForgeCardStatus, overrides: Partial<ForgeCardView> = {}): ForgeCardView {
  return {
    id,
    reference: `FORGE-${id}`,
    storyId: id * 10,
    storyReference: `S-${id}`,
    title: `Story ${id}`,
    projectId: 1,
    subjectId: 5,
    subjectTitle: 'Mails',
    stepKey,
    provider: 'claude',
    status,
    claudeSessionId: null,
    durationSeconds: 0,
    costUsd: 0,
    ...overrides,
  }
}

const WORKFLOW: ProjectWorkflow = {
  columns: [
    column(1, 'spec', { autoStart: true }),
    column(2, 'review', { provider: 'human', model: '', effort: '' }),
    column(3, 'build'),
  ],
  maySettle: false,
  admin: { login: 'ana', name: 'Ana' },
}

const THREAD: StoryThread = {
  reference: 'S-2',
  state: 'building',
  opening: null,
  awaitsValidation: false,
  chapters: [
    {
      phase: 'spec',
      claudeSessionId: 'abc',
      agentName: 'architecte',
      openedAt: '2026-09-28T10:00:00Z',
      collapsed: false,
      entries: [
        { kind: 'testimony', at: '2026-09-28T10:05:00Z', author: 'ana', voice: 'human', body: 'Keep it small', evidencePath: null },
      ],
    },
  ],
}

let cards: ForgeCardView[]
let wrapper: VueWrapper | null = null

function answer(path: string): unknown {
  if (path === '/api/projects') {
    return [
      { id: 1, slug: 'hopla', name: 'Hopla', colour: '#7C3AED' },
      { id: 2, slug: 'skera', name: 'Skera', colour: '#00AAFF' },
    ]
  }
  if (path.startsWith('/api/forge-cards?project=')) {
    return cards
  }
  if (path === '/api/projects/1/workflow-columns') {
    return WORKFLOW
  }
  if (path === '/api/projects/2/workflow-columns') {
    return { columns: [], maySettle: false, admin: null }
  }
  if (path.endsWith('/epics')) {
    return [
      { id: 5, title: 'Mails' },
      { id: 6, title: 'Invoices' },
    ]
  }
  if (path === '/api/fleet') {
    return { roster: null, jobs: [{ id: 'j1', state: 'working' }] }
  }
  if (path === '/api/machine') {
    return {
      available: true,
      reason: null,
      snapshot: { cpuPercent: 38, memoryUsedMb: 11000, memoryFreeMb: 4000, diskPercent: 61, loadAverage: 1 },
    }
  }
  if (path === '/api/settings/budget') {
    return { policy: { capUsd: 20 }, spentUsd: 3.4 }
  }
  if (path.endsWith('/thread')) {
    return THREAD
  }
  return []
}

async function mountScreen(): Promise<VueWrapper> {
  wrapper = mount(ForgeScreen, {
    global: {
      plugins: [createBoardI18n('en')],
      provide: { [routerKey as symbol]: { push } },
      stubs: { ResourceScreen: { template: '<p>resource-content</p>' } },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function inBody(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector)
}

beforeEach(() => {
  window.localStorage.clear()
  cards = [card(1, 'backlog', 'idle'), card(2, 'spec', 'to_validate'), card(3, 'spec', 'running')]
  read.mockReset()
  send.mockReset()
  push.mockReset()
  read.mockImplementation((path: string) => Promise.resolve(answer(path)))
  send.mockResolvedValue({ card: cards[0], started: false, claudeSessionId: null })
  streamed = null
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('the view choice', () => {
  it('opens on the kanban by default', async () => {
    const screen = await mountScreen()

    expect(screen.find('[data-test="forge-kanban"]').exists()).toBe(true)
    expect(screen.find('[data-test="forge-pipeline"]').exists()).toBe(false)
  })

  it('remembers the pipeline once chosen, and restores it on the next visit', async () => {
    const first = await mountScreen()
    const pipelineButton = first.findAll('button').find((button) => button.text() === 'Pipeline')
    await pipelineButton?.trigger('click')

    expect(window.localStorage.getItem(FORGE_VIEW_KEY)).toBe('pipeline')
    expect(first.find('[data-test="forge-pipeline"]').exists()).toBe(true)

    first.unmount()
    wrapper = null
    const second = await mountScreen()
    expect(second.find('[data-test="forge-pipeline"]').exists()).toBe(true)
  })

  it('ignores a stored value that is not a view', async () => {
    window.localStorage.setItem(FORGE_VIEW_KEY, 'gantt')

    const screen = await mountScreen()

    expect(screen.find('[data-test="forge-kanban"]').exists()).toBe(true)
  })

  it('sends the chosen view to the account', async () => {
    const screen = await mountScreen()
    await screen.findAll('button').find((button) => button.text() === 'Pipeline')?.trigger('click')

    expect(send).toHaveBeenCalledWith('/api/board/preferences', 'PUT', { forgeView: 'pipeline' })
  })

  it('opens on the view saved with the account, whatever this browser remembers', async () => {
    window.localStorage.setItem(FORGE_VIEW_KEY, 'kanban')
    const base = read.getMockImplementation()
    read.mockImplementation((path: string) =>
      path === '/api/board/preferences' ? Promise.resolve({ forgeView: 'pipeline' }) : base?.(path),
    )

    const screen = await mountScreen()

    expect(screen.find('[data-test="forge-pipeline"]').exists()).toBe(true)
    expect(window.localStorage.getItem(FORGE_VIEW_KEY)).toBe('pipeline')
  })

  it('keeps the browser choice when the account has none or the call fails', async () => {
    window.localStorage.setItem(FORGE_VIEW_KEY, 'pipeline')
    const base = read.getMockImplementation()
    read.mockImplementation((path: string) =>
      path === '/api/board/preferences' ? Promise.reject(new Error('down')) : base?.(path),
    )
    send.mockRejectedValue(new Error('down'))

    const screen = await mountScreen()

    expect(screen.find('[data-test="forge-pipeline"]').exists()).toBe(true)
  })
})

describe('the kanban', () => {
  it('has one column per step, the backlog first and done last', async () => {
    const screen = await mountScreen()

    const keys = screen.findAll('section[data-step]').map((column) => column.attributes('data-step'))
    expect(keys).toEqual(['backlog', 'spec', 'review', 'build', 'done'])
  })

  it('scrolls each column on its own and the board sideways inside its frame', async () => {
    const screen = await mountScreen()

    const board = screen.get('[data-test="forge-kanban"]')
    expect(board.classes()).toContain('overflow-x-auto')
    const column = screen.get('section[data-step="spec"]')
    expect(column.classes()).toContain('overflow-y-auto')
    expect(column.get('header').classes()).toContain('sticky')
    expect(screen.get('[data-test="forge-screen"]').classes()).toContain('overflow-x-hidden')
  })

  it('files each card in its column', async () => {
    const screen = await mountScreen()

    expect(screen.get('section[data-step="backlog"]').text()).toContain('Story 1')
    expect(screen.get('section[data-step="spec"]').text()).toContain('Story 2')
    expect(screen.get('section[data-step="spec"]').text()).toContain('Story 3')
  })

  it('moves a card to the next step with the arrow button, without any drag', async () => {
    const screen = await mountScreen()

    const next = screen
      .get('section[data-step="backlog"]')
      .findAll('button')
      .find((button) => button.attributes('aria-label') === 'Move Story 1 to Spec')
    await next?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/1/move', 'POST', { stepKey: 'spec' })
  })

  it('moves a card by drag and drop', async () => {
    const screen = await mountScreen()
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }

    await screen.get('section[data-step="backlog"] [data-test="forge-card"]').trigger('dragstart', { dataTransfer })
    await screen.get('section[data-step="build"]').trigger('dragover', { dataTransfer })
    await screen.get('section[data-step="build"]').trigger('drop', { dataTransfer })
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/1/move', 'POST', { stepKey: 'build' })
  })

  it('does not accept a drop in done nor a drag of a running card', async () => {
    const screen = await mountScreen()
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }

    await screen.get('section[data-step="backlog"] [data-test="forge-card"]').trigger('dragstart', { dataTransfer })
    await screen.get('section[data-step="done"]').trigger('drop', { dataTransfer })
    await flushPromises()

    expect(send).not.toHaveBeenCalled()
    const running = screen.findAll('section[data-step="spec"] [data-test="forge-card"]')[1]
    expect(running?.attributes('draggable')).toBe('false')
  })

  it('offers no arrow past the ends', async () => {
    const screen = await mountScreen()

    const inBacklog = screen.get('section[data-step="backlog"] [data-test="forge-card"]').findAll('button')
    expect(inBacklog.find((button) => button.text() === '‹')?.attributes('disabled')).toBeDefined()
  })

  it('launches a backlog card by moving it into the first step', async () => {
    const screen = await mountScreen()

    const launch = screen
      .get('section[data-step="backlog"] [data-test="forge-card"]')
      .findAll('button')
      .find((button) => button.text() === 'Launch')
    await launch?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/1/move', 'POST', { stepKey: 'spec' })
  })

  it('validates a waiting card into the next step', async () => {
    const screen = await mountScreen()

    const validate = screen
      .findAll('section[data-step="spec"] [data-test="forge-card"]')[0]
      ?.findAll('button')
      .find((button) => button.text().startsWith('Validate'))
    await validate?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/2/move', 'POST', { stepKey: 'review' })
  })

  it('stops a running session', async () => {
    const screen = await mountScreen()

    const stop = screen
      .findAll('section[data-step="spec"] [data-test="forge-card"]')[1]
      ?.findAll('button')
      .find((button) => button.text() === 'Stop')
    await stop?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/stories/30/talk', 'DELETE')
  })

  it('shows the refusal of the board when a move is refused', async () => {
    const { BoardRequestError } = await import('@/technical/Api/BoardClient')
    send.mockRejectedValue(new BoardRequestError(409, 'StoryTooThinError', 'too thin'))
    const screen = await mountScreen()

    await screen
      .get('section[data-step="backlog"]')
      .findAll('button')
      .find((button) => button.attributes('aria-label') === 'Move Story 1 to Spec')
      ?.trigger('click')
    await flushPromises()

    expect(screen.get('[role="alert"]').text()).toContain('too thin to be launched')
  })
})

describe('the pipeline', () => {
  it('floats the running and failed stories to the top, with one dot per step', async () => {
    window.localStorage.setItem(FORGE_VIEW_KEY, 'pipeline')
    cards = [card(1, 'backlog', 'idle'), card(2, 'spec', 'to_validate'), card(3, 'build', 'failed'), card(4, 'spec', 'running')]

    const screen = await mountScreen()

    const rows = screen.findAll('[data-test="forge-row"]')
    expect(rows.map((row) => row.find('button').text())).toEqual(['Story 4', 'Story 3', 'Story 2', 'Story 1'])
    expect(rows[0]?.findAll('[data-test="forge-dot"]').map((dot) => dot.attributes('data-state'))).toEqual([
      'running',
      'to_come',
      'to_come',
    ])
  })
})

describe('the project pills and the filters', () => {
  it('filters the cards by subject', async () => {
    cards = [card(1, 'backlog', 'idle'), card(2, 'backlog', 'idle', { subjectId: 6, subjectTitle: 'Invoices' })]
    const screen = await mountScreen()

    await screen.get('select[aria-label="Filter by subject"]').setValue(6)

    expect(screen.text()).not.toContain('Story 1')
    expect(screen.text()).toContain('Story 2')
  })

  it('switches project and reads its own workflow', async () => {
    const screen = await mountScreen()

    await screen
      .findAll('button')
      .find((button) => button.text() === 'Skera')
      ?.trigger('click')
    await flushPromises()

    expect(read).toHaveBeenCalledWith('/api/projects/2/workflow-columns')
    expect(screen.findAll('section[data-step]').map((entry) => entry.attributes('data-step'))).toEqual(['backlog', 'done'])
    expect(screen.text()).toContain('No workflow for Skera yet')
  })

  it('refreshes the workflow settings count after the starter workflow is created', async () => {
    let created = false
    read.mockImplementation((path: string) => {
      if (path === '/api/projects/2/workflow-columns') {
        return Promise.resolve({
          columns: created ? WORKFLOW.columns : [],
          maySettle: true,
          admin: { login: 'ana', name: 'Ana' },
        })
      }
      return Promise.resolve(answer(path))
    })
    send.mockImplementation((path: string) => {
      if (path === '/api/projects/2/workflow-columns') {
        created = true
      }
      return Promise.resolve({})
    })
    const screen = await mountScreen()
    await screen
      .findAll('button')
      .find((button) => button.text() === 'Skera')
      ?.trigger('click')
    await flushPromises()
    expect(screen.text()).toContain('0 steps')

    await screen
      .findAll('button')
      .find((button) => button.text() === 'Create the workflow')
      ?.trigger('click')
    await flushPromises()

    expect(screen.text()).toContain('3 steps')
  })

  it('adds a story to the backlog from the board', async () => {
    const screen = await mountScreen()

    await screen.get('input[aria-label="Title of the story"]').setValue('Export the mails')
    await screen.get('form').trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/backlog', 'POST', { subjectId: 5, title: 'Export the mails' })
  })
})

describe('the resources bar', () => {
  it('shows the sessions, the gauges, the budget and the room left', async () => {
    const screen = await mountScreen()

    const bar = screen.get('[data-test="forge-resources"]')
    expect(bar.text()).toContain('1 session in progress')
    expect(bar.text()).toContain('CPU')
    expect(bar.text()).toContain('3.40 / 20.00 $')
    expect(bar.get('[data-test="forge-resource-room"]').text()).toBe('Room for 4 more sessions')
  })

  it('opens the resource details in a drawer', async () => {
    const screen = await mountScreen()

    await screen
      .findAll('button')
      .find((button) => button.text() === 'Resource details')
      ?.trigger('click')
    await flushPromises()

    expect(inBody('[data-test="forge-resource-drawer"]')?.textContent).toContain('resource-content')
  })
})

describe('the card drawer', () => {
  async function openCard(title: string): Promise<VueWrapper> {
    const screen = await mountScreen()
    await screen.get(`button[aria-label="Open ${title}"]`).trigger('click')
    await flushPromises()
    return screen
  }

  it('opens the story page from the drawer so a thin story can be completed', async () => {
    await openCard('Story 2')

    inBody('[data-test="forge-open-story"]')?.click()

    expect(push).toHaveBeenCalledWith('/me/stories/20')
  })

  it('shows the thread of the card with a marker per step', async () => {
    await openCard('Story 2')

    const drawer = inBody('[data-test="forge-drawer"]')
    expect(drawer?.textContent).toContain('Keep it small')
    expect(drawer?.textContent).toContain('Specification')
    expect(drawer?.textContent).toContain('Hopla')
  })

  it('sends the reply on Enter and adds a line on Shift+Enter', async () => {
    await openCard('Story 3')
    const field = inBody('#forge-reply') as HTMLTextAreaElement

    field.value = 'go on'
    field.dispatchEvent(new Event('input'))
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))
    await flushPromises()
    expect(send).not.toHaveBeenCalledWith('/api/stories/30/talk', 'POST', expect.anything())

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/stories/30/talk', 'POST', { message: 'go on' })
  })

  it('adds a note instead of talking when the card is in the backlog or a human step', async () => {
    await openCard('Story 1')
    const field = inBody('#forge-reply') as HTMLTextAreaElement

    field.value = 'remember the export'
    field.dispatchEvent(new Event('input'))
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/stories/10/discussion', 'POST', { body: 'remember the export' })
  })

  it('shows the working indicator and the live messages, tools included', async () => {
    await openCard('Story 3')

    streamed?.({ name: 'session.assistant', payload: { reference: 'FORGE-3 (S-3)', text: 'Reading the spec' } })
    streamed?.({
      name: 'session.assistant',
      payload: { reference: 'FORGE-3 (S-3)', tools: [{ id: 't1', name: 'Read', outcome: 'started' }] },
    })
    streamed?.({
      name: 'session.user',
      payload: { reference: 'FORGE-3 (S-3)', tools: [{ id: 't1', name: '', outcome: 'failed' }] },
    })
    await flushPromises()

    const drawer = inBody('[data-test="forge-drawer"]')
    expect(drawer?.textContent).toContain('The agent is working')
    expect(drawer?.textContent).toContain('Reading the spec')
    expect(drawer?.querySelector('[data-test="forge-tool"]')?.textContent).toContain('Tool Read')
    expect(drawer?.querySelector('[data-test="forge-tool"]')?.textContent).toContain('failed')
    expect(drawer?.querySelector('[role="status"]')?.textContent).toContain('The agent says: Reading the spec')
  })

  it('launches or validates from the drawer and closes with the button', async () => {
    await openCard('Story 2')

    ;(inBody('[data-test="forge-drawer-action"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/forge-cards/2/move', 'POST', { stepKey: 'review' })

    const close = [...document.body.querySelectorAll<HTMLButtonElement>('[data-test="forge-drawer"] button')].find(
      (button) => button.textContent?.trim() === 'Close',
    )
    close?.click()
    await flushPromises()
    expect(inBody('[data-test="forge-drawer"]')).toBeNull()
  })

  it('closes on Escape', async () => {
    await openCard('Story 2')

    ;(inBody('[data-test="forge-drawer"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await flushPromises()

    expect(inBody('[data-test="forge-drawer"]')).toBeNull()
  })
})

describe('adding a story', () => {
  it('only offers the subjects the person can hold', async () => {
    const base = read.getMockImplementation()
    read.mockImplementation((path: string) => {
      if (path === '/api/board/self') {
        return Promise.resolve({ login: 'anna', superAdmin: false })
      }
      if (path.endsWith('/epics')) {
        return Promise.resolve([
          { id: 5, title: 'Mails', assignee: 'anna' },
          { id: 6, title: 'Invoices', assignee: 'bob' },
          { id: 7, title: 'Billing', assignee: null },
        ])
      }
      return base?.(path)
    })

    const screen = await mountScreen()

    const select = screen.get('select[aria-label="Subject of the story"]')
    expect(select.findAll('option').map((option) => option.text())).toEqual(['Mails', 'Billing'])
  })
})
