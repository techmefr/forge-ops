export const DRAWER_TABS = ['story', 'plan', 'review', 'delivery', 'discussion'] as const

export type DrawerTab = (typeof DRAWER_TABS)[number]

const TAB_OF_STATE: Readonly<Record<string, DrawerTab>> = {
  architecture: 'plan',
  plan_review: 'plan',
  building: 'story',
  gating: 'review',
  reviewing: 'review',
  shipping: 'delivery',
  flagged: 'delivery',
  done: 'delivery',
}

export function tabOfState(state: string): DrawerTab {
  return TAB_OF_STATE[state] ?? 'story'
}
