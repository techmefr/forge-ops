import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createBoardI18n } from '@/technical/Language/I18n'
import AppShell from '@/domain/Shell/AppShell.vue'

vi.mock('@/technical/Api/Board', () => ({
  board: { read: () => Promise.resolve({ jobs: [] }) },
}))

async function mounted(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<p>page</p>' } }],
  })
  await router.push(path)
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [createBoardI18n('en'), router],
      stubs: { StatusPill: true, LanguageSwitch: true, TourGuide: true },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('AppShell accessibility', () => {
  it('exposes the four screens as navigation links with the current one marked', async () => {
    const { wrapper } = await mounted('/settings')
    const nav = wrapper.find('nav[aria-label]')
    const links = nav.findAll('a')
    expect(links).toHaveLength(4)
    const current = links.filter((link) => link.attributes('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]?.text()).toContain('Settings')
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('has a single banner landmark and a labelled page heading region', async () => {
    const { wrapper } = await mounted('/projects/subjects')
    expect(wrapper.findAll('header')).toHaveLength(1)
    const region = wrapper.find('section[aria-labelledby="page-heading"]')
    expect(region.find('h1#page-heading').text()).toBe('Projects')
    wrapper.unmount()
  })

  it('titles the document after the current screen', async () => {
    const { wrapper, router } = await mounted('/projects')
    expect(document.title).toBe('Projects · Forge.ops')
    await router.push('/statistics')
    await flushPromises()
    expect(document.title).toBe('Statistics · Forge.ops')
    wrapper.unmount()
  })
})
