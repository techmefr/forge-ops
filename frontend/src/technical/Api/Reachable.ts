import { isDesktop } from './Addresses.js'
import { desktopFetch } from './DesktopFetch.js'

const PROBE_PATH = '/api/board/mode'
const PROBE_TIMEOUT_MS = 5000

export async function checkInstanceReachable(instanceUrl: string): Promise<boolean> {
  const base = instanceUrl.trim().replace(/\/+$/, '')
  const fetcher = isDesktop() ? desktopFetch : fetch
  try {
    const response = await fetcher(`${base}${PROBE_PATH}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return response.status < 500
  } catch {
    return false
  }
}
