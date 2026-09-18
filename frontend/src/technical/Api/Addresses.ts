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

export function readAddresses(): Addresses {
  if (typeof window === 'undefined') {
    return SAME_ORIGIN
  }
  return addressesOf((window as unknown as Record<string, unknown>).forgeAddresses)
}
