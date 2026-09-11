export const SPOT_CLASS = 'tour-spot'

export const SPOT_ATTRIBUTE = 'data-tour'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

export function findSpot(anchor: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(`[${SPOT_ATTRIBUTE}="${anchor}"]`)
  } catch {
    return null
  }
}

function unfoldAncestors(element: HTMLElement): void {
  let parent: HTMLElement | null = element.parentElement
  while (parent !== null) {
    if (parent instanceof HTMLDetailsElement) {
      parent.open = true
    }
    parent = parent.parentElement
  }
}

export function clearSpot(): void {
  for (const marked of document.querySelectorAll<HTMLElement>(`.${SPOT_CLASS}`)) {
    marked.classList.remove(SPOT_CLASS)
    marked.removeAttribute('data-tour-spot')
  }
}

export function lightSpot(anchor: string, label: string): HTMLElement | null {
  clearSpot()
  const target = findSpot(anchor)
  if (target === null) {
    return null
  }
  unfoldAncestors(target)
  target.classList.add(SPOT_CLASS)
  target.setAttribute('data-tour-spot', label)
  target.scrollIntoView?.({
    block: 'nearest',
    inline: 'nearest',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
  return target
}
