import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import ProjectEmptyState from '@/domain/Board/ProjectEmptyState.vue'
import ProjectCreateForm from '@/domain/Board/ProjectCreateForm.vue'

vi.mock('@/technical/Api/Board', () => ({
  board: {
    send: vi.fn(),
  },
}))

function mounted() {
  return mount(ProjectEmptyState, {
    global: {
      plugins: [createBoardI18n('fr')],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('ProjectEmptyState', () => {
  it("montre le message d'etat vide et un lien vers la configuration du workflow", () => {
    const state = mounted()

    expect(state.text()).toContain('Aucun projet')
    expect(state.find('a').exists()).toBe(true)
  })

  it('ouvre le formulaire de creation au clic sur le bouton', async () => {
    const state = mounted()

    expect(state.findComponent(ProjectCreateForm).exists()).toBe(false)

    await state.find('button').trigger('click')

    expect(state.findComponent(ProjectCreateForm).exists()).toBe(true)
  })

  it('relaie la creation du projet vers le parent et referme le formulaire', async () => {
    const state = mounted()
    await state.find('button').trigger('click')

    await state.findComponent(ProjectCreateForm).vm.$emit('created')

    expect(state.emitted('created')).toBeTruthy()
    expect(state.findComponent(ProjectCreateForm).exists()).toBe(false)
  })
})
