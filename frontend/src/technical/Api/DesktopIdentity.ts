import { isDesktop } from './Addresses.js'
import { activeServer } from './Servers.js'

export function identityHeaders(): Record<string, string> {
  if (!isDesktop()) {
    return {}
  }
  const token = activeServer()?.token ?? null
  return token === null
    ? { 'x-forge-client': 'desktop' }
    : { 'x-forge-client': 'desktop', 'x-forge-identity': token }
}
