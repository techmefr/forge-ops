const PROBE_PATH = '/api/board/mode'
const PROBE_TIMEOUT_MS = 5000

export async function checkInstanceReachable(instanceUrl: string): Promise<boolean> {
  const base = instanceUrl.trim().replace(/\/+$/, '')
  try {
    const response = await fetch(`${base}${PROBE_PATH}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return response.status < 500
  } catch {
    return false
  }
}
