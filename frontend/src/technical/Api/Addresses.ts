import { activeServer } from './Servers.js'

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

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function readAddresses(): Addresses {
  if (typeof window === 'undefined') {
    return SAME_ORIGIN
  }
  if (isDesktop()) {
    const server = activeServer()
    return server === null
      ? SAME_ORIGIN
      : { instanceUrl: server.instanceUrl, serverUrl: server.serverUrl }
  }
  return addressesOf((window as unknown as Record<string, unknown>).forgeAddresses)
}

export function hasDesktopAddresses(): boolean {
  return activeServer() !== null
}

export type AddressProblem = 'scheme' | 'credentials' | 'cleartext'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function isPrivateHost(hostname: string): boolean {
  if (LOOPBACK_HOSTS.has(hostname)) {
    return true
  }
  const match = IPV4.exec(hostname)
  if (match === null) {
    return false
  }
  const first = Number(match[1])
  const second = Number(match[2])
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)
}

export function addressProblemOf(value: string): AddressProblem | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return 'scheme'
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'scheme'
  }
  if (url.username !== '' || url.password !== '') {
    return 'credentials'
  }
  if (url.protocol === 'http:' && !isPrivateHost(url.hostname)) {
    return 'cleartext'
  }
  return null
}
