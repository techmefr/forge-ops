import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePanelFocus } from '../../../src/technical/Ui/UsePanelFocus.js'

function harness(close: () => void) {
  return defineComponent({
    setup() {
      const panel = ref<HTMLElement | null>(null)
      const { onKeydown } = usePanelFocus(panel, close)
      return () => h('aside', { ref: panel, tabindex: -1, onKeydown }, [h('button', 'inside')])
    },
  })
}

describe('usePanelFocus', () => {
  it('moves the focus into the panel on mount', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(harness(() => undefined), { attachTo: host })
    expect(document.activeElement).toBe(wrapper.element)
    wrapper.unmount()
    host.remove()
  })

  it('gives the focus back to the opener on unmount', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const wrapper = mount(harness(() => undefined), { attachTo: document.body })
    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('closes on Escape', async () => {
    const close = vi.fn()
    const wrapper = mount(harness(close), { attachTo: document.body })
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('ignores an Escape another handler already took', async () => {
    const close = vi.fn()
    const wrapper = mount(harness(close), { attachTo: document.body })
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    event.preventDefault()
    wrapper.element.dispatchEvent(event)
    expect(close).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
