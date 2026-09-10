export const NAV_LAYOUTS = ['rail', 'tabs'] as const

export type NavLayout = (typeof NAV_LAYOUTS)[number]

export const NAV_LAYOUT_LABELS: Readonly<Record<NavLayout, string>> = {
  rail: 'Barre laterale',
  tabs: 'Onglets',
}

export const NAV_STORAGE_KEY = 'forge.nav'

export function readLayout(): NavLayout {
  try {
    const stored = window.localStorage.getItem(NAV_STORAGE_KEY)
    return NAV_LAYOUTS.includes(stored as NavLayout) ? (stored as NavLayout) : 'rail'
  } catch {
    return 'rail'
  }
}

export function writeLayout(layout: NavLayout): void {
  try {
    window.localStorage.setItem(NAV_STORAGE_KEY, layout)
  } catch {
    return
  }
}
