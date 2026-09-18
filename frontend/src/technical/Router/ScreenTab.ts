export const PROJECT_TABS = ['board', 'deployment'] as const
export const PERSONAL_TABS = ['stories', 'files', 'view', 'resources'] as const

export type ProjectTab = (typeof PROJECT_TABS)[number]
export type PersonalTab = (typeof PERSONAL_TABS)[number]

export const PROJECT_BASE = '/projects'
export const PERSONAL_BASE = '/me'

export function tabOfRoute<Tab extends string>(
  tabs: readonly Tab[],
  raw: unknown,
): Tab {
  const wanted = typeof raw === 'string' ? raw : ''
  return tabs.find((tab) => tab === wanted) ?? (tabs[0] as Tab)
}
