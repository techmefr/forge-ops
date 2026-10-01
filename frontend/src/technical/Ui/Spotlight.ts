export const SPOT_CLASS = 'tour-spot'

export const TAG_CLASS = 'tour-tag'

export const SPOT_ATTRIBUTE = 'data-tour'

const TAG_GAP_PX = 6

const TAG_EDGE_PX = 4

export type Box = {
  left: number
  top: number
  width: number
  height: number
}

export type Size = {
  width: number
  height: number
}

export type TagPosition = {
  left: number
  top: number
}

let tag: HTMLElement | null = null
let anchored: HTMLElement | null = null

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

export function tagPositionOf(target: Box, size: Size, viewport: Size): TagPosition {
  const left = Math.min(
    Math.max(target.left + 8, TAG_EDGE_PX),
    Math.max(viewport.width - size.width - TAG_EDGE_PX, TAG_EDGE_PX),
  )
  const above = target.top - size.height - TAG_GAP_PX
  if (above >= TAG_EDGE_PX) {
    return { left, top: above }
  }
  const beside = target.left + target.width + TAG_GAP_PX
  if (beside + size.width <= viewport.width - TAG_EDGE_PX) {
    return { left: beside, top: Math.max(target.top, TAG_EDGE_PX) }
  }
  const below = target.top + target.height + TAG_GAP_PX
  if (below + size.height <= viewport.height - TAG_EDGE_PX) {
    return { left, top: below }
  }
  return { left, top: Math.max(target.top + TAG_GAP_PX, TAG_EDGE_PX) }
}

function placeTag(): void {
  if (tag === null || anchored === null) {
    return
  }
  const position = tagPositionOf(
    anchored.getBoundingClientRect(),
    { width: tag.offsetWidth, height: tag.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  )
  tag.style.left = `${position.left}px`
  tag.style.top = `${position.top}px`
}

export function clearSpot(): void {
  for (const marked of document.querySelectorAll<HTMLElement>(`.${SPOT_CLASS}`)) {
    marked.classList.remove(SPOT_CLASS)
  }
  window.removeEventListener('resize', placeTag)
  window.removeEventListener('scroll', placeTag, true)
  tag?.remove()
  tag = null
  anchored = null
}

export function lightSpot(anchor: string, label: string): HTMLElement | null {
  clearSpot()
  const target = findSpot(anchor)
  if (target === null) {
    return null
  }
  unfoldAncestors(target)
  target.classList.add(SPOT_CLASS)
  tag = document.createElement('span')
  tag.className = TAG_CLASS
  tag.setAttribute('aria-hidden', 'true')
  tag.textContent = label
  document.body.append(tag)
  anchored = target
  target.scrollIntoView?.({
    block: 'nearest',
    inline: 'nearest',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
  placeTag()
  window.addEventListener('resize', placeTag)
  window.addEventListener('scroll', placeTag, true)
  return target
}
