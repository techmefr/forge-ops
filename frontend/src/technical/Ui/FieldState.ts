import { nextTick, watch, type Ref } from 'vue'
import type { Phrase } from '@/technical/Language/Phrase'

type Root = HTMLElement | { $el: unknown } | null

function elementOf(root: Root): HTMLElement | null {
  if (root === null) {
    return null
  }
  const node = root instanceof HTMLElement ? root : root.$el
  return node instanceof HTMLElement ? node : null
}

export type FieldState = {
  'aria-required': 'true'
  'aria-invalid': 'true' | undefined
  'aria-describedby': string | undefined
}

export function requiredField(refusal: Phrase | null, errorId: string): FieldState {
  const refused = refusal !== null
  return {
    'aria-required': 'true',
    'aria-invalid': refused ? 'true' : undefined,
    'aria-describedby': refused ? errorId : undefined,
  }
}

export function useRefusalFocus(refusal: Ref<Phrase | null>, root: Ref<Root>): void {
  watch(refusal, async (next) => {
    if (next === null) {
      return
    }
    await nextTick()
    elementOf(root.value)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}

export function useAlertFocus(refusal: Ref<Phrase | null>, root: Ref<Root>): void {
  watch(refusal, async (next) => {
    if (next === null) {
      return
    }
    await nextTick()
    elementOf(root.value)?.querySelector<HTMLElement>('[role="alert"]')?.focus()
  })
}
