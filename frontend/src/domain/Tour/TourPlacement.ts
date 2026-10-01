import type { Box, Size } from '@/technical/Ui/Spotlight'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export const CORNERS: readonly Corner[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left']

export const POPOVER_SIDE_PX = 12

export const POPOVER_WIDE_SIDE_PX = 20

export const POPOVER_TOP_PX = 12

export const POPOVER_BOTTOM_PX = 56

const WIDE_FROM_PX = 640

function boxAt(corner: Corner, size: Size, viewport: Size): Box {
  const side = viewport.width >= WIDE_FROM_PX ? POPOVER_WIDE_SIDE_PX : POPOVER_SIDE_PX
  const left = corner.endsWith('left') ? side : viewport.width - side - size.width
  const top = corner.startsWith('top') ? POPOVER_TOP_PX : viewport.height - POPOVER_BOTTOM_PX - size.height
  return { left, top, width: size.width, height: size.height }
}

function overlapArea(one: Box, other: Box): number {
  const width = Math.min(one.left + one.width, other.left + other.width) - Math.max(one.left, other.left)
  const height = Math.min(one.top + one.height, other.top + other.height) - Math.max(one.top, other.top)
  return width > 0 && height > 0 ? width * height : 0
}

export function popoverCorner(target: Box | null, size: Size, viewport: Size): Corner {
  if (target === null) {
    return 'bottom-right'
  }
  let best: Corner = 'bottom-right'
  let bestArea = Number.POSITIVE_INFINITY
  for (const corner of CORNERS) {
    const area = overlapArea(boxAt(corner, size, viewport), target)
    if (area < bestArea) {
      best = corner
      bestArea = area
    }
  }
  return best
}
