import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import ProjectCreateForm from '@/domain/Board/ProjectCreateForm.vue'

const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

function mounted() {
  return mount(ProjectCreateForm, {
    global: { plugins: [createBoardI18n('fr')] },
  })
}

describe('ProjectCreateForm', () => {
  it("envoie le brouillon de projet et previent le parent une fois cree", async () => {
    send.mockResolvedValue({ id: 1 })
    const form = mounted()

    await form.find('input[type="text"]').setValue('Skera')
    const texts = form.findAll('input[type="text"]')
    await texts[1]?.setValue('skera')
    await texts[2]?.setValue('https://gitlab.skera.com/skera/skera.git')
    await texts[3]?.setValue('main')

    await form.find('form').trigger('submit')
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects', 'POST', {
      slug: 'skera',
      name: 'Skera',
      repositoryUrl: 'https://gitlab.skera.com/skera/skera.git',
      integrationBranch: 'main',
      colour: '#5b8def',
    })
    expect(form.emitted('created')).toBeTruthy()
  })

  it('affiche le refus quand la creation echoue', async () => {
    send.mockRejectedValue(new Error('slug deja pris'))
    const form = mounted()

    const texts = form.findAll('input[type="text"]')
    await texts[0]?.setValue('Skera')
    await texts[1]?.setValue('skera')
    await texts[2]?.setValue('https://gitlab.skera.com/skera/skera.git')
    await texts[3]?.setValue('main')

    await form.find('form').trigger('submit')
    await flushPromises()

    expect(form.find('[role="alert"]').exists()).toBe(true)
    expect(form.emitted('created')).toBeFalsy()
  })

  it('previent le parent sur annulation', async () => {
    const form = mounted()

    await form.findAll('button')[1]?.trigger('click')

    expect(form.emitted('cancel')).toBeTruthy()
  })
})

describe('ProjectCreateForm accessibility', () => {
  it('marks the four required fields and explains the marker', () => {
    const form = mounted()
    const texts = form.findAll('input[type="text"]')
    expect(texts).toHaveLength(4)
    for (const input of texts) {
      expect(input.attributes('aria-required')).toBe('true')
    }
    expect(form.findAll('span[aria-hidden="true"]').length).toBeGreaterThanOrEqual(5)
    expect(form.text()).toContain('champ obligatoire')
  })

  it('ties the refusal to the fields and focuses the first one', async () => {
    send.mockRejectedValue(new Error('slug deja pris'))
    const form = mount(ProjectCreateForm, {
      attachTo: document.body,
      global: { plugins: [createBoardI18n('fr')] },
    })
    const texts = form.findAll('input[type="text"]')
    await texts[0]?.setValue('Skera')
    await texts[1]?.setValue('skera')
    await texts[2]?.setValue('https://x/y.git')
    await form.find('form').trigger('submit')
    await flushPromises()
    const alert = form.find('[role="alert"]')
    expect(alert.attributes('id')).toBe('project-create-refusal')
    expect(texts[0]?.attributes('aria-invalid')).toBe('true')
    expect(texts[0]?.attributes('aria-describedby')).toBe('project-create-refusal')
    expect(document.activeElement).toBe(texts[0]?.element)
    form.unmount()
  })
})
