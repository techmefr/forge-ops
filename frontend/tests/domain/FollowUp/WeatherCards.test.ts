import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import WeatherCards from '@/domain/FollowUp/WeatherCards.vue'
import type { ProjectFollowUp, ProjectRisk } from '@contract/FollowUpContract'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

function project(id: number, name: string) {
  return {
    id,
    slug: name.toLowerCase(),
    name,
    repositoryUrl: 'u',
    integrationBranch: 'main',
    colour: 'acc',
    checkoutPath: null,
  }
}

function risk(over: Partial<ProjectRisk>): ProjectRisk {
  return {
    id: 1,
    projectId: 1,
    text: 'Vendor may slip',
    level: 'high',
    owner: null,
    epicId: null,
    openedOn: '2026-09-20',
    closedOn: null,
    ...over,
  }
}

function followUp(projectId: number, over: Partial<ProjectFollowUp>): ProjectFollowUp {
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
    ...over,
  }
}

const STORMY = followUp(1, {
  statusSentence: 'Waiting for the client',
  weather: 'stormy',
  score: { late: 2, blocked: 1, highRisks: 1, total: 4 },
  alerts: { late: 2, blocked: 1, highRisks: 1, minutesToWrite: 1 },
  nextEvent: {
    id: 9,
    type: 'client',
    date: '2026-10-05',
    title: 'Client review',
    projectId: 1,
    epicId: null,
    note: null,
    minutes: null,
    minutesUpdatedAt: null,
  },
  risks: [risk({ id: 1 })],
})

const QUIET = followUp(2, {})

function serve(follow: Record<number, ProjectFollowUp>): void {
  const responses: Record<string, unknown> = {
    '/api/projects': [project(1, 'Skera'), project(2, 'Forge')],
    '/api/projects/1/follow-up': follow[1],
    '/api/projects/2/follow-up': follow[2],
    '/api/projects/1/epics': [],
    '/api/projects/2/epics': [],
    '/api/projects/1/links': [],
    '/api/projects/2/links': [],
  }
  read.mockImplementation((path: string) => Promise.resolve(responses[path] ?? []))
}

async function mounted(props: { projectId?: number | null } = {}) {
  const cards = mount(WeatherCards, {
    props,
    attachTo: document.body,
    global: { plugins: [createBoardI18n('en')] },
  })
  await flushPromises()
  return cards
}

beforeEach(() => {
  read.mockReset()
  send.mockReset()
  send.mockResolvedValue({})
  serve({ 1: STORMY, 2: QUIET })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the weather cards', () => {
  it('shows one card per project with its weather word and its status sentence', async () => {
    const cards = await mounted()
    const first = cards.find('[data-test-id="weather-card-1"]')
    expect(first.text()).toContain('Skera')
    expect(first.text()).toContain('Stormy')
    expect(first.text()).toContain('Waiting for the client')
    expect(cards.find('[data-test-id="weather-card-2"]').text()).toContain('Sunny')
  })

  it('puts the weather word in the accessible name of the card', async () => {
    const cards = await mounted()
    const stormy = cards.find('[data-test-id="weather-card-1"] button')
    expect(stormy.attributes('aria-label')).toBeUndefined()
    expect(stormy.text()).toContain('Skera')
    expect(stormy.text()).toContain('Stormy')
    expect(cards.find('[data-test-id="weather-card-2"] button').text()).toContain('Sunny')
  })

  it('keeps only the asked project when given a project', async () => {
    const cards = await mounted({ projectId: 2 })
    expect(cards.find('[data-test-id="weather-card-1"]').exists()).toBe(false)
    expect(cards.find('[data-test-id="weather-card-2"]').exists()).toBe(true)
  })
})

describe('the card content', () => {
  it('shows the counters, the high risks and the next event on the card itself', async () => {
    const cards = await mounted()
    const card = cards.find('[data-test-id="weather-card-1"]')
    expect(card.find('[data-test-id="weather-counters"]').text()).toContain('2')
    expect(card.text()).toContain('Late')
    expect(card.text()).toContain('Blocked')
    expect(card.text()).toContain('1 high risk')
    expect(card.text()).toContain('Next: client meeting on')
    expect(card.text()).toContain('Client review')
  })

  it('says that nothing is planned for a quiet project and hides the risk line', async () => {
    const cards = await mounted()
    const card = cards.find('[data-test-id="weather-card-2"]')
    expect(card.text()).toContain('No event planned')
    expect(card.text()).not.toContain('high risk')
  })

  it('draws the weather with an icon, never with a text pictograph', async () => {
    const cards = await mounted()
    const chip = cards.find('[data-test-id="weather-card-1"] svg')
    expect(chip.exists()).toBe(true)
    expect(cards.find('[data-test-id="weather-card-1"]').text()).not.toMatch(/[\u2600-\u26FF]/)
  })

  it('counts the open subjects and draws a progress bar of the done ones', async () => {
    const subject = (id: number, projectId: number, state: string) => ({ id, projectId, state })
    read.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/epics'
          ? [subject(1, 1, 'done'), subject(2, 1, 'doing'), subject(3, 1, 'blocked'), subject(4, 1, 'todo')]
          : ({
              '/api/projects': [project(1, 'Skera'), project(2, 'Forge')],
              '/api/projects/1/follow-up': STORMY,
              '/api/projects/2/follow-up': QUIET,
            } as Record<string, unknown>)[path] ?? [],
      ),
    )
    const cards = await mounted()
    const card = cards.find('[data-test-id="weather-card-1"]')
    expect(card.text()).toContain('1 of 4 subjects done')
    const bar = card.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('1')
    expect(bar.attributes('aria-valuemax')).toBe('4')
    expect(card.find('[data-test-id="weather-counters"]').text()).toContain('3')
  })

  it('opens the follow-up drawer when the card is clicked', async () => {
    const cards = await mounted()
    await cards.find('[data-test-id="weather-card-1"] button').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Follow-up · Skera')
  })
})
