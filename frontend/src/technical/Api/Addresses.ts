export type Addresses = {
  instanceUrl: string
  serverUrl: string | null
}

export const SAME_ORIGIN: Addresses = { instanceUrl: '', serverUrl: null }

function trimmed(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  return value.trim().replace(/\/+$/, '')
}

export function addressesOf(declared: unknown): Addresses {
  if (typeof declared !== 'object' || declared === null) {
    return SAME_ORIGIN
  }
  const record = declared as Record<string, unknown>
  return {
    instanceUrl: trimmed(record.instanceUrl) ?? SAME_ORIGIN.instanceUrl,
    serverUrl: trimmed(record.serverUrl),
  }
}

export const DESKTOP_ADDRESSES_KEY = 'forge.addresses'

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function storedAddresses(): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(DESKTOP_ADDRESSES_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function readAddresses(): Addresses {
  if (typeof window === 'undefined') {
    return SAME_ORIGIN
  }
  if (isDesktop()) {
    return addressesOf(storedAddresses())
  }
  return addressesOf((window as unknown as Record<string, unknown>).forgeAddresses)
}

export function hasDesktopAddresses(): boolean {
  return addressesOf(storedAddresses()).instanceUrl !== SAME_ORIGIN.instanceUrl
}

export function saveDesktopAddresses(addresses: Addresses): void {
  window.localStorage.setItem(DESKTOP_ADDRESSES_KEY, JSON.stringify(addresses))
}

export function isHttpAddress(value: string): boolean {
  return /^https?:\/\/[^\s/]+/i.test(value.trim())
}
