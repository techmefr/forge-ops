import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { routerKey } from 'vue-router'
import type { ForgeCardStatus, ForgeCardView } from '@contract/ForgeCardContract'
import type { StoryThread } from '@contract/ConversationContract'
import type { ProjectWorkflow, WorkflowColumn } from '@contract/WorkflowColumnContract'
import { createBoardI18n } from '@/technical/Language/I18n'
import type { StreamedEvent } from '@/technical/Api/BoardStream'
import ForgeScreen from '@/domain/Forge/ForgeScreen.vue'

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
    workflowId: 1,
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
    maxRetries: 2,
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
    workflowId: 1,
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

const DEFAULT_WORKFLOW = { id: 1, projectId: 1, key: 'default', name: 'Default', position: 1 }

const THREAD: StoryThread = {
  toolLogs: [],
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
  if (path === '/api/projects/1/workflows') {
    return { workflows: [DEFAULT_WORKFLOW], maySettle: false }
  }
  if (path === '/api/projects/2/workflows') {
    return { workflows: [], maySettle: false }
  }
  if (path === '/api/projects/1/workflow-columns?workflow=1' || path === '/api/projects/1/workflow-columns') {
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

function rowOf(screen: VueWrapper, title: string): DOMWrapper<Element> {
  const found = screen.findAll('[data-test="forge-row"]').find((row) => row.find('button').text() === title)
  if (found === undefined) {
    throw new Error(`no row for ${title}`)
  }
  return found
}

function buttonOf(row: DOMWrapper<Element>, label: string | RegExp): DOMWrapper<HTMLButtonElement> | undefined {
  return row
    .findAll<HTMLButtonElement>('button')
    .find((button) => (typeof label === 'string' ? button.text() === label : label.test(button.text())))
}

describe('the flow', () => {
  it('has no kanban nor view switch any more', async () => {
    const screen = await mountScreen()

    expect(screen.find('[data-test="forge-kanban"]').exists()).toBe(false)
    expect(screen.findAll('button').some((button) => button.text() === 'Pipeline')).toBe(false)
  })

  it('lists one row per card, each with the steps of its workflow', async () => {
    const screen = await mountScreen()

    const rows = screen.findAll('[data-test="forge-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]?.findAll('[data-test="forge-dot"]').map((dot) => dot.text())).toEqual([
      expect.stringContaining('Spec'),
      expect.stringContaining('Review'),
      expect.stringContaining('Build'),
    ])
  })

  it('scrolls the steps sideways inside the row so a phone can follow them', async () => {
    const screen = await mountScreen()

    const steps = screen.get('[data-test="forge-row"] ol')
    expect(steps.classes()).toContain('overflow-x-auto')
  })

  it('does not name the workflow while the project has only one', async () => {
    const screen = await mountScreen()

    expect(screen.findAll('[data-test="forge-lane"]')).toHaveLength(1)
  })

  it('floats the running and failed stories to the top, with one dot per step', async () => {
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

  it('launches a backlog card by moving it into the first step', async () => {
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 1'), 'Launch')?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/1/move', 'POST', { stepKey: 'spec' })
  })

  it('validates a waiting card into the next step', async () => {
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 2'), /^Validate/)?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/2/move', 'POST', { stepKey: 'review' })
  })

  it('stops a running session', async () => {
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 3'), 'Stop')?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/stories/30/talk', 'DELETE')
  })

  it('shows the refusal of the board when a move is refused', async () => {
    const { BoardRequestError } = await import('@/technical/Api/BoardClient')
    send.mockRejectedValue(new BoardRequestError(409, 'StoryTooThinError', 'too thin'))
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 1'), 'Launch')?.trigger('click')
    await flushPromises()

    expect(screen.get('[role="alert"]').text()).toContain('too thin to be launched')
  })
})

describe('several workflows in one project', () => {
  const FIX = { id: 2, projectId: 1, key: 'hotfix', name: 'Hotfix', position: 2 }

  function withHotfix(): void {
    const base = read.getMockImplementation()
    read.mockImplementation((path: string) => {
      if (path === '/api/projects/1/workflows') {
        return Promise.resolve({ workflows: [DEFAULT_WORKFLOW, FIX], maySettle: false })
      }
      if (path === '/api/projects/1/workflow-columns?workflow=2') {
        return Promise.resolve({
          columns: [
            column(10, 'diagnose', { workflowId: 2 }),
            column(11, 'patch', { workflowId: 2 }),
          ],
          maySettle: false,
          admin: null,
        })
      }
      return base?.(path)
    })
  }

  it('groups the rows by workflow and names each group', async () => {
    withHotfix()
    cards = [card(1, 'spec', 'idle'), card(2, 'diagnose', 'running', { workflowId: 2 })]

    const screen = await mountScreen()

    const lanes = screen.findAll('[data-test="forge-lane"]')
    expect(lanes.map((lane) => lane.get('[data-test="forge-lane-title"]').text())).toEqual(['Default 1', 'Hotfix 1'])
    expect(lanes[1]?.findAll('[data-test="forge-dot"]').map((dot) => dot.text())).toEqual([
      expect.stringContaining('Diagnose'),
      expect.stringContaining('Patch'),
    ])
  })

  it('moves a card along the steps of its own workflow', async () => {
    withHotfix()
    cards = [card(2, 'backlog', 'idle', { workflowId: 2 })]

    const screen = await mountScreen()
    await buttonOf(rowOf(screen, 'Story 2'), 'Launch')?.trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/2/move', 'POST', { stepKey: 'diagnose' })
  })

  it('asks the workflow of a new story, and sends it', async () => {
    withHotfix()
    const screen = await mountScreen()

    await screen.get('input[aria-label="Title of the story"]').setValue('Repair the export')
    await screen.get('[data-test="forge-new-workflow"]').setValue(2)
    await screen.get('form').trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/backlog', 'POST', {
      subjectId: 5,
      title: 'Repair the export',
      workflowId: 2,
    })
  })

  it('does not ask the workflow of a new story while the project has only one', async () => {
    const screen = await mountScreen()

    expect(screen.find('[data-test="forge-new-workflow"]').exists()).toBe(false)
  })
})

describe('the step history', () => {
  it('opens a step already passed in read only, without any reply field nor action', async () => {
    cards = [card(1, 'review', 'to_validate')]
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 1'), /^Spec/)?.trigger('click')
    await flushPromises()

    expect(inBody('[data-test="forge-drawer-history"]')?.textContent).toContain('History of the Spec step')
    expect(inBody('#forge-reply')).toBeNull()
    expect(inBody('[data-test="forge-drawer-action"]')).toBeNull()
    expect(inBody('[data-test="forge-drawer"]')?.textContent).toContain('Keep it small')
  })

  it('only shows the thread of the phase of the step', async () => {
    cards = [card(1, 'build', 'to_validate')]
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 1'), /^Review/)?.trigger('click')
    await flushPromises()

    expect(inBody('[data-test="forge-drawer"]')?.textContent).not.toContain('Keep it small')
  })

  it('opens the current step with the reply field', async () => {
    cards = [card(1, 'spec', 'running')]
    const screen = await mountScreen()

    await buttonOf(rowOf(screen, 'Story 1'), /^Spec/)?.trigger('click')
    await flushPromises()

    expect(inBody('[data-test="forge-drawer-history"]')).toBeNull()
    expect(inBody('#forge-reply')).not.toBeNull()
  })

  it('does not open a step still to come', async () => {
    cards = [card(1, 'spec', 'running')]
    const screen = await mountScreen()

    const upcoming = buttonOf(rowOf(screen, 'Story 1'), /^Build/)

    expect(upcoming?.attributes('disabled')).toBeDefined()
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
    expect(screen.findAll('[data-test="forge-row"]')).toHaveLength(0)
    expect(screen.text()).toContain('No workflow for Skera yet')
  })

  it('refreshes the workflow settings count after the starter workflow is created', async () => {
    let created = false
    read.mockImplementation((path: string) => {
      if (path === '/api/projects/2/workflows') {
        return Promise.resolve({
          workflows: created ? [{ id: 2, projectId: 2, key: 'default', name: 'Default', position: 1 }] : [],
          maySettle: true,
        })
      }
      if (path === '/api/projects/2/workflow-columns?workflow=2') {
        return Promise.resolve({ columns: WORKFLOW.columns, maySettle: true, admin: { login: 'ana', name: 'Ana' } })
      }
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
    expect(screen.text()).toContain('0 workflows')

    await screen
      .findAll('button')
      .find((button) => button.text() === 'Create the workflow')
      ?.trigger('click')
    await flushPromises()

    expect(screen.text()).toContain('1 workflow')
  })

  it('adds a story to the backlog from the board', async () => {
    const screen = await mountScreen()

    await screen.get('input[aria-label="Title of the story"]').setValue('Export the mails')
    await screen.get('form').trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/backlog', 'POST', { subjectId: 5, title: 'Export the mails' })
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

  it('moves a card to the next step from the drawer, without any drag', async () => {
    await openCard('Story 1')

    expect(inBody('[data-test="forge-drawer-previous"]')).toBeNull()
    ;(inBody('[data-test="forge-drawer-next"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/forge-cards/1/move', 'POST', { stepKey: 'spec' })
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
