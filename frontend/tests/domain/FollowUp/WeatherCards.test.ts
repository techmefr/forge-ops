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

describe('the hover panel', () => {
  it('is closed until the card is hovered, and lists the alerts, the next event and the source', async () => {
    const cards = await mounted()
    const zone = cards.find('[data-test-id="weather-card-1"]')
    expect(zone.find('[data-test-id="weather-panel"]').isVisible()).toBe(false)
    await zone.trigger('mouseenter')
    const panel = zone.find('[data-test-id="weather-panel"]')
    expect(panel.isVisible()).toBe(true)
    expect(panel.text()).toContain('2 late · 1 blocked · 1 high risk · 1 set of minutes to write')
    expect(panel.text()).toContain('Next: client meeting on')
    expect(panel.text()).toContain('Client review')
    expect(panel.text()).toContain('Weather computed')
  })

  it('opens on keyboard focus and closes when the focus leaves', async () => {
    const cards = await mounted()
    const zone = cards.find('[data-test-id="weather-card-1"]')
    await zone.find('button').trigger('focusin')
    expect(zone.find('[data-test-id="weather-panel"]').isVisible()).toBe(true)
    await zone.find('button').trigger('focusout', { relatedTarget: document.body })
    expect(zone.find('[data-test-id="weather-panel"]').isVisible()).toBe(false)
  })

  it('closes on Escape', async () => {
    const cards = await mounted()
    const zone = cards.find('[data-test-id="weather-card-1"]')
    await zone.trigger('mouseenter')
    await zone.trigger('keydown', { key: 'Escape' })
    expect(zone.find('[data-test-id="weather-panel"]').isVisible()).toBe(false)
  })

  it('floats over the page instead of pushing it', async () => {
    const cards = await mounted()
    const panel = cards.find('[data-test-id="weather-card-1"] [data-test-id="weather-panel"]')
    expect(panel.classes()).toContain('absolute')
  })

  it('says there is nothing to report and that no event is planned for a quiet project', async () => {
    const cards = await mounted()
    const zone = cards.find('[data-test-id="weather-card-2"]')
    await zone.trigger('mouseenter')
    const panel = zone.find('[data-test-id="weather-panel"]')
    expect(panel.text()).toContain('Nothing to report')
    expect(panel.text()).toContain('No event planned')
  })

  it('tells when the weather was set by hand', async () => {
    serve({ 1: { ...STORMY, source: 'manual' }, 2: QUIET })
    const cards = await mounted()
    const zone = cards.find('[data-test-id="weather-card-1"]')
    await zone.trigger('mouseenter')
    expect(zone.find('[data-test-id="weather-panel"]').text()).toContain('Weather set by hand')
  })

  it('describes the button by its panel so the details are read on focus', async () => {
    const cards = await mounted()
    const zone = cards.find('[data-test-id="weather-card-1"]')
    const describedBy = zone.find('button').attributes('aria-describedby')
    expect(zone.find(`#${describedBy}`).exists()).toBe(true)
  })
})

describe('the follow-up drawer', () => {
  async function opened() {
    const cards = await mounted()
    await cards.find('[data-test-id="weather-card-1"] button').trigger('click')
    await flushPromises()
    return cards
  }

  it('opens on click with the risks of the project', async () => {
    await opened()
    const drawer = document.body.querySelector('[data-test-id="follow-up-drawer"]')
    expect(drawer?.textContent).toContain('Follow-up · Skera')
    expect(drawer?.textContent).toContain('Vendor may slip')
    expect(drawer?.textContent).toContain('Risks · 1 open')
  })

  it('closes a high risk and refreshes the weather without a reload of the page', async () => {
    const cards = await opened()
    serve({
      1: followUp(1, {
        weather: 'cloudy',
        score: { late: 2, blocked: 1, highRisks: 0, total: 3 },
        alerts: { late: 2, blocked: 1, highRisks: 0, minutesToWrite: 1 },
        risks: [risk({ id: 1, closedOn: '2026-09-29' })],
      }),
      2: QUIET,
    })
    const toggle = document.body.querySelector<HTMLButtonElement>('[data-test-id="risk-1"] button')
    toggle?.click()
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/risks/1', 'PATCH', { closed: true })
    expect(cards.find('[data-test-id="weather-card-1"]').text()).toContain('Cloudy')
  })

  it('sends the manual weather and goes back to automatic with an empty choice', async () => {
    await opened()
    const select = document.body.querySelector<HTMLSelectElement>('[data-test-id="weather-select"]')
    if (select === null) {
      throw new Error('weather select missing')
    }
    select.value = 'sunny'
    select.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/projects/1/weather', 'PUT', { weather: 'sunny' })
    select.value = ''
    select.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/projects/1/weather', 'PUT', { weather: null })
  })

  it('adds a risk and a decision', async () => {
    await opened()
    const forms = document.body.querySelectorAll('form')
    const submit = async (form: Element | undefined, value: string) => {
      const field = form?.querySelector<HTMLInputElement>('input[type="text"]')
      if (field === null || field === undefined) {
        throw new Error('field missing')
      }
      field.value = value
      field.dispatchEvent(new Event('input'))
      await flushPromises()
      form?.dispatchEvent(new Event('submit', { cancelable: true }))
      await flushPromises()
    }
    await submit(forms[0], 'Data is stale')
    expect(send).toHaveBeenCalledWith(
      '/api/projects/1/risks',
      'POST',
      expect.objectContaining({ text: 'Data is stale', level: 'medium', owner: null, epicId: null }),
    )
    await submit(forms[1], 'Scope is frozen')
    expect(send).toHaveBeenCalledWith('/api/projects/1/decisions', 'POST', { text: 'Scope is frozen' })
  })

  it('lists the events with the minutes to write flagged', async () => {
    serve({
      1: {
        ...STORMY,
        events: [
          {
            id: 4,
            type: 'steering',
            date: '2026-01-10',
            title: 'Steering',
            projectId: 1,
            epicId: null,
            note: null,
            minutes: null,
            minutesUpdatedAt: null,
          },
        ],
      },
      2: QUIET,
    })
    await opened()
    const row = document.body.querySelector('[data-test-id="event-4"]')
    expect(row?.textContent).toContain('Minutes to write')
    expect(row?.querySelector('button')?.getAttribute('aria-label')).toContain('Write the minutes')
  })
})
