import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Tooltip from '@/technical/Ui/Tooltip.vue'

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', StubResizeObserver)

describe('la bulle daide associe son texte au declencheur', () => {
  it('affiche le texte au focus clavier, pas seulement au survol', async () => {
    const wrapper = mount(Tooltip, {
      props: { label: 'Reduire' },
      slots: { default: '<button type="button" aria-label="Reduire">–</button>' },
      attachTo: document.body,
    })

    const trigger = wrapper.find('button')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('aria-label')).toBe('Reduire')

    await trigger.trigger('focus')
    await wrapper.vm.$nextTick()

    const describedBy = trigger.attributes('aria-describedby')
    expect(describedBy).toBeTruthy()

    wrapper.unmount()
  })

  it('garde le libelle aria-label du bouton en plus de la bulle', () => {
    const wrapper = mount(Tooltip, {
      props: { label: 'Agrandir' },
      slots: { default: '<button type="button" aria-label="Agrandir">&lt;&gt;</button>' },
    })

    expect(wrapper.find('button').attributes('aria-label')).toBe('Agrandir')
  })
})
