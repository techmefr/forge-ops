import { onBeforeUnmount, onMounted, type Ref } from 'vue'

export function usePanelFocus(panel: Ref<HTMLElement | null>, close: () => void) {
  let opener: HTMLElement | null = null

  onMounted(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.value?.focus()
  })

  onBeforeUnmount(() => {
    if (opener !== null && opener.isConnected) {
      opener.focus()
    }
  })

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.stopPropagation()
      close()
    }
  }

  return { onKeydown }
}
