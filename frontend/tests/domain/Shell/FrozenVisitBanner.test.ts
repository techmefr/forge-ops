import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { LANGUAGES } from '@/technical/Language/Language'
import { createBoardI18n } from '@/technical/Language/I18n'
import { MESSAGES } from '@/technical/Language/Locale/Locales'
import FrozenVisitBanner from '@/domain/Shell/FrozenVisitBanner.vue'

vi.mock('@/technical/Api/DemoStream', () => ({ resetDemo: vi.fn() }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FrozenVisitBanner', () => {
  it.each(LANGUAGES)('labels its dismiss button apart from the tour Skip in %s', (language) => {
    const messages = MESSAGES[language] as unknown as { visit: { dismiss: string }; tour: { skip: string } }
    expect(messages.visit.dismiss.length).toBeGreaterThan(0)
    expect(messages.visit.dismiss).not.toBe(messages.tour.skip)
  })

  it('shows Dismiss, not Skip, and closes the banner', async () => {
    const banner = mount(FrozenVisitBanner, { global: { plugins: [createBoardI18n('en')] } })
    const dismiss = banner.get('[data-test-id="demo-dismiss"]')
    expect(dismiss.text()).toBe('Dismiss')
    expect(banner.text()).not.toContain('Skip')

    await dismiss.trigger('click')

    expect(banner.find('aside').exists()).toBe(false)
  })

  it('keeps every control at least 44px wide on a phone, whatever the language', () => {
    const banner = mount(FrozenVisitBanner, { global: { plugins: [createBoardI18n('zh')] } })
    const controls = banner.findAll('a, button')
    expect(controls).toHaveLength(3)
    for (const control of controls) {
      expect(control.classes()).toContain('min-w-11')
      expect(control.classes()).toContain('min-h-11')
    }
  })
})
