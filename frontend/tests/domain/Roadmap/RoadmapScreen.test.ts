import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import RoadmapScreen from '@/domain/Roadmap/RoadmapScreen.vue'
import type { ProjectEvent } from '@contract/EventContract'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

const PROJECT = {
  id: 1,
  slug: 'skera',
  name: 'Skera',
  repositoryUrl: 'u',
  integrationBranch: 'main',
  colour: 'acc',
  checkoutPath: null,
}

function epic(id: number, title: string, startedOn: string | null, state = 'doing') {
  return { id, projectId: 1, title, businessIntent: '', assignee: 'gaetan', startedOn, state }
}

function event(over: Partial<ProjectEvent>): ProjectEvent {
  return {
    id: 1,
    type: 'demo',
    date: '2026-10-10',
    title: '',
    projectId: 1,
    epicId: null,
    note: null,
    minutes: null,
    minutesUpdatedAt: null,
    ...over,
  }
}

function serve(epics: unknown[], events: ProjectEvent[]): void {
  const responses: Record<string, unknown> = {
    '/api/projects': [PROJECT],
    '/api/projects/1/epics': epics,
    '/api/projects/1/events': events,
    '/api/projects/1/links': [{ kind: 'repo', url: 'https://example.com/repo' }],
    '/api/projects/1/follow-up': {
      projectId: 1,
      statusSentence: null,
      weather: 'sunny',
      source: 'computed',
      score: { late: 0, blocked: 0, highRisks: 0, total: 0 },
      alerts: { late: 0, blocked: 0, highRisks: 0, minutesToWrite: 0 },
      nextEvent: null,
      risks: [],
      decisions: [],
      events,
    },
  }
  read.mockImplementation((path: string) => Promise.resolve(responses[path] ?? []))
}

async function mounted(language: 'en' | 'fr' = 'en') {
  const screen = mount(RoadmapScreen, {
    attachTo: document.body,
    global: { plugins: [createBoardI18n(language)] },
  })
  await flushPromises()
  return screen
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 28, 10, 0))
  read.mockReset()
  send.mockReset()
  send.mockResolvedValue({})
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('RoadmapScreen', () => {
  it('shows every project with its subjects, even without any event', async () => {
    serve([epic(1, 'Cloudmail', '2026-09-01')], [])
    const screen = await mounted()
    expect(screen.find('[data-test-id="roadmap-project-1"]').text()).toContain('Skera')
    expect(screen.text()).toContain('Cloudmail')
  })

  it('draws a focusable bar with a full label from the start to the next milestone', async () => {
    serve([epic(1, 'Cloudmail', '2026-09-01')], [event({ id: 5, epicId: 1, date: '2026-10-20' })])
    const screen = await mounted()
    const bars = screen.findAll('[data-test-id="roadmap-bar"]')
    expect(bars).toHaveLength(1)
    expect(bars[0]?.attributes('tabindex')).toBe('0')
    const label = bars[0]?.attributes('aria-label') ?? ''
    expect(label).toContain('Cloudmail')
    expect(label).toContain('gaetan')
    expect(label).toContain('In progress')
    expect(label).toContain('2026')
  })

  it('hatches a late subject and says how late it is', async () => {
    serve([epic(1, 'Cloudmail', '2026-09-01')], [event({ id: 5, epicId: 1, date: '2026-09-20' })])
    const screen = await mounted()
    expect(screen.find('.roadmap-late').exists()).toBe(true)
    expect(screen.find('[data-test-id="roadmap-bar"]').attributes('aria-label')).toContain('8 days late')
    expect(screen.text()).toContain('Late')
  })

  it('does not hatch a subject that is on time', async () => {
    serve([epic(1, 'Cloudmail', '2026-09-01')], [event({ id: 5, epicId: 1, date: '2026-10-20' })])
    expect((await mounted()).find('.roadmap-late').exists()).toBe(false)
  })

  it('lists under the chart the subjects with no start or no milestone', async () => {
    serve(
      [epic(1, 'Cloudmail', '2026-09-01'), epic(2, 'Billing', null), epic(3, 'Search', '2026-09-05')],
      [event({ id: 5, epicId: 1, date: '2026-10-20' })],
    )
    const screen = await mounted()
    const undated = screen.find('[data-test-id="roadmap-undated-1"]').text()
    expect(undated).toContain('Billing')
    expect(undated).toContain('Search')
    expect(undated).not.toContain('Cloudmail')
    expect(screen.findAll('[data-test-id="roadmap-bar"]')).toHaveLength(1)
  })

  it('lists the upcoming events with the days left, past ones excluded', async () => {
    serve(
      [],
      [
        event({ id: 1, type: 'production', title: 'Release', date: '2026-09-30' }),
        event({ id: 2, type: 'steering', title: 'Old committee', date: '2026-09-11' }),
        event({ id: 3, type: 'client', title: 'Today call', date: '2026-09-28' }),
      ],
    )
    const upcoming = (await mounted()).find('[data-test-id="roadmap-upcoming"]').text()
    expect(upcoming).toContain('D-2')
    expect(upcoming).toContain('Release')
    expect(upcoming).toContain('Today')
    expect(upcoming).not.toContain('Old committee')
  })

  it('speaks french days as J-x', async () => {
    serve([], [event({ id: 1, title: 'Démo', date: '2026-09-30' })])
    expect((await mounted('fr')).find('[data-test-id="roadmap-upcoming"]').text()).toContain('J-2')
  })

  it('flags minutes to write on the project and on the subject, only for past events without minutes', async () => {
    serve(
      [epic(1, 'Cloudmail', '2026-09-01')],
      [
        event({ id: 1, type: 'client', epicId: 1, date: '2026-09-20' }),
        event({ id: 2, type: 'demo', epicId: 1, date: '2026-10-20' }),
        event({ id: 3, type: 'steering', date: '2026-09-11', minutes: 'Decided' }),
      ],
    )
    const screen = await mounted()
    expect(screen.find('[data-test-id="roadmap-project-1"]').text()).toContain('1 minutes to write')
    expect(screen.text()).toContain('Minutes to write')
  })

  it('gives each event diamond a label with its type, title, date and the minutes flag', async () => {
    serve([], [event({ id: 1, type: 'client', title: 'TDS review', date: '2026-09-20' })])
    const screen = await mounted()
    const mark = screen.find('[data-test-id="roadmap-project-1"] button')
    const label = mark.attributes('aria-label') ?? ''
    expect(label).toContain('Client meeting')
    expect(label).toContain('TDS review')
    expect(label).toContain('Minutes to write')
  })

  it('scrolls the chart inside its own frame', async () => {
    serve([epic(1, 'Cloudmail', '2026-09-01')], [])
    const frame = (await mounted()).find('[data-test-id="roadmap-frame"]')
    expect(frame.classes()).toContain('overflow-x-auto')
    expect(frame.attributes('tabindex')).toBe('0')
  })

  it('writes the minutes of an event through PATCH and reloads', async () => {
    serve([], [event({ id: 7, type: 'client', title: 'TDS review', date: '2026-09-20' })])
    await mounted()
    const opener = document.body.querySelector('[data-test-id="roadmap-project-1"] button') as HTMLElement
    opener.click()
    await flushPromises()
    const minutes = document.body.querySelector('textarea[rows="5"]') as HTMLTextAreaElement
    minutes.value = 'Scope agreed'
    minutes.dispatchEvent(new Event('input'))
    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(send).toHaveBeenCalledWith(
      '/api/events/7',
      'PATCH',
      expect.objectContaining({ minutes: 'Scope agreed', type: 'client', date: '2026-09-20' }),
    )
  })

  it('creates an event linked to a subject listed without dates', async () => {
    serve([epic(2, 'Billing', null)], [])
    const screen = await mounted()
    await screen.find('[data-test-id="roadmap-undated-1"] button').trigger('click')
    await flushPromises()
    const date = document.body.querySelector('input[type="date"]') as HTMLInputElement
    date.value = '2026-10-12'
    date.dispatchEvent(new Event('input'))
    const form = document.body.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(send).toHaveBeenCalledWith(
      '/api/events',
      'POST',
      expect.objectContaining({ projectId: 1, epicId: 2, date: '2026-10-12', type: 'demo' }),
    )
  })
})
