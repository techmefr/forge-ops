import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createBoardI18n } from '@/technical/Language/I18n'
import AppShell from '@/domain/Shell/AppShell.vue'

vi.mock('@/technical/Api/Board', () => ({
  board: { read: () => Promise.resolve({ jobs: [] }) },
}))

vi.mock('@/technical/Api/Visit', () => ({ FROZEN_VISIT: true }))

async function mounted() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<p>page</p>' } }],
  })
  await router.push('/projects/subjects')
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [createBoardI18n('en'), router],
      stubs: { MachineBadge: true, LanguageSwitch: true, TourGuide: true, ServerMenu: true },
    },
  })
  await flushPromises()
  return wrapper
}

describe('AppShell focus order', () => {
  it('puts the skip link first, then the navigation, the content and the demo banner', async () => {
    const wrapper = await mounted()
    const focusable = [...document.body.querySelectorAll<HTMLElement>('a[href], button, main')]
    const skip = wrapper.get('[data-test-id="skip-link"]').element
    const nav = wrapper.get('nav a').element
    const main = wrapper.get('main').element
    const banner = wrapper.get('aside button').element
    expect(focusable[0]).toBe(skip)
    const order = [skip, nav, main, banner].map((node) => focusable.indexOf(node as HTMLElement))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    wrapper.unmount()
  })

  it('keeps the skip link first on a direct load by never scrolling the current link into view', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const wrapper = await mounted()
    const router = wrapper.vm.$router
    await router.push('/settings')
    await flushPromises()
    await router.push('/statistics')
    await flushPromises()
    expect(scrollIntoView).not.toHaveBeenCalled()
    const focusable = [...document.body.querySelectorAll<HTMLElement>('a[href], button')]
    expect(focusable[0]).toBe(wrapper.get('[data-test-id="skip-link"]').element)
    expect(document.activeElement).toBe(document.body)
    wrapper.unmount()
  })

  it('still centres the current link inside the navigation strip', async () => {
    const wrapper = await mounted()
    const strip = wrapper.get('nav').element as HTMLElement
    const scrollTo = vi.fn()
    strip.scrollTo = scrollTo as unknown as typeof strip.scrollTo
    await wrapper.vm.$router.push('/settings')
    await flushPromises()
    expect(scrollTo).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('moves focus to the main content when the skip link is used', async () => {
    const wrapper = await mounted()
    await wrapper.get('[data-test-id="skip-link"]').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('main').element)
    wrapper.unmount()
  })
})
