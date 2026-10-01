import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createBoardI18n } from '@/technical/Language/I18n'
import TourGuide from '@/domain/Tour/TourGuide.vue'

vi.mock('@/technical/Api/Board', () => ({
  LOGIN_PATH: '/login',
  board: { read: () => Promise.resolve({ environment: 'demo' }), send: vi.fn() },
}))

let wrapper: VueWrapper | null = null

async function openTour(): Promise<void> {
  const slot = document.createElement('span')
  slot.id = 'tour-slot'
  document.body.appendChild(slot)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<p>page</p>' } }],
  })
  await router.push('/projects/subjects')
  wrapper = mount(TourGuide, {
    attachTo: document.body,
    global: { plugins: [createBoardI18n('en'), router], stubs: { GhostPointer: true } },
  })
  await flushPromises()
  await vi.advanceTimersByTimeAsync(3000)
  await flushPromises()
}

function guidedTourButton(): HTMLButtonElement {
  const found = [...document.body.querySelectorAll<HTMLButtonElement>('#tour-slot button')]
  const button = found.find((candidate) => candidate.textContent?.trim() === 'Guided tour')
  if (button === undefined) {
    throw new Error('the Guided tour button is not in the page')
  }
  return button
}

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('the tour hands focus back', () => {
  it('returns focus to the Guided tour button after Escape', async () => {
    await openTour()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(guidedTourButton())
  })

  it('returns focus to the Guided tour button after Skip', async () => {
    await openTour()
    const skip = [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (candidate) => candidate.textContent?.trim() === 'Skip',
    )

    skip?.click()
    await flushPromises()

    expect(document.activeElement).toBe(guidedTourButton())
  })
})
