import { createBoardClient, isRejection } from './BoardClient.js'
import { createDemoFetcher, type DemoSnapshot } from './DemoFetcher.js'
import { FROZEN_VISIT } from './Visit.js'
import { demoEnvironment } from './DemoStream.js'
import { isDesktop, readAddresses } from './Addresses.js'
import { activeServer } from './Servers.js'
import { desktopFetch } from './DesktopFetch.js'

function identityHeaders(): Record<string, string> {
  const token = isDesktop() ? (activeServer()?.token ?? null) : null
  if (!isDesktop()) {
    return {}
  }
  return token === null
    ? { 'x-forge-client': 'desktop' }
    : { 'x-forge-client': 'desktop', 'x-forge-identity': token }
}

export const LOGIN_PATH = '/login'

let redirectToLogin: (() => void) | null = null

export function setLoginRedirect(redirect: () => void): void {
  redirectToLogin = redirect
}

function askForTheWayIn(): void {
  if (typeof window === 'undefined' || window.location.pathname === LOGIN_PATH) {
    return
  }
  if (redirectToLogin !== null) {
    redirectToLogin()
    return
  }
  window.location.assign(LOGIN_PATH)
}

async function loadSnapshot(): Promise<DemoSnapshot> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo-snapshot.json`)
  return (await response.json()) as DemoSnapshot
}

export const board = FROZEN_VISIT
  ? createBoardClient({ fetcher: createDemoFetcher(loadSnapshot, demoEnvironment) })
  : createBoardClient({
      baseUrl: readAddresses().instanceUrl,
      onUnauthorized: askForTheWayIn,
      headers: identityHeaders,
      fetcher: isDesktop() ? desktopFetch : fetch,
    })

export async function checkBoardSession(): Promise<boolean> {
  try {
    await board.read('/api/auth/whoami')
    return true
  } catch (error) {
    return !isRejection(error)
  }
}
