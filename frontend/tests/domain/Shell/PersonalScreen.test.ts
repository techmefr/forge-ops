import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type * as VueRouter from 'vue-router'
import { createBoardI18n } from '@/technical/Language/I18n'
import PersonalScreen from '@/domain/Shell/PersonalScreen.vue'

const read = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return { ...actual, useRoute: () => ({ params: {} }) }
})

function onPath(path: string, response: unknown): void {
  read.mockImplementation((requested: string) =>
    requested === path ? Promise.resolve(response) : Promise.resolve([]),
  )
}

function mounted() {
  return mount(PersonalScreen, {
    global: {
      plugins: [createBoardI18n('fr')],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        StoryScreen: true,
        FileScreen: true,
        ViewScreen: true,
        ResourceScreen: true,
        PersonalTally: true,
        ScreenTabs: true,
      },
    },
  })
}

describe('PersonalScreen', () => {
  it("montre l'etat vide quand aucun projet n'existe", async () => {
    onPath('/api/projects', [])

    const screen = mounted()
    await flushPromises()

    expect(screen.find('[data-tour="project-empty-state"]').exists()).toBe(true)
  })

  it("cache l'etat vide des qu'un projet existe", async () => {
    onPath('/api/projects', [{ id: 1, slug: 'demo' }])

    const screen = mounted()
    await flushPromises()

    expect(screen.find('[data-tour="project-empty-state"]').exists()).toBe(false)
  })

  it("ne montre rien tant que la reponse n'est pas encore arrivee", () => {
    read.mockImplementation(() => new Promise(() => {}))

    const screen = mounted()

    expect(screen.find('[data-tour="project-empty-state"]').exists()).toBe(false)
  })
})
