import { ref, type Ref } from 'vue'
import { readLayout, writeLayout, type NavLayout } from './Navigation.js'

const layout = ref<NavLayout>('rail')

let started = false

export type NavigationDesk = {
  layout: Ref<NavLayout>
  selectLayout: (next: NavLayout) => void
}

export function useNavigation(): NavigationDesk {
  if (!started) {
    started = true
    layout.value = readLayout()
  }

  return {
    layout,
    selectLayout: (next) => {
      layout.value = next
      writeLayout(next)
    },
  }
}
