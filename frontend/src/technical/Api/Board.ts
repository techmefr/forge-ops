import { createBoardClient } from './BoardClient.js'
import { createDemoFetcher, type DemoSnapshot } from './DemoFetcher.js'
import { FROZEN_VISIT } from './Visit.js'
import { readAddresses } from './Addresses.js'

export const LOGIN_PATH = '/login'

function askForTheWayIn(): void {
  if (typeof window === 'undefined' || window.location.pathname === LOGIN_PATH) {
    return
  }
  window.location.assign(LOGIN_PATH)
}

async function loadSnapshot(): Promise<DemoSnapshot> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo-snapshot.json`)
  return (await response.json()) as DemoSnapshot
}

export const board = FROZEN_VISIT
  ? createBoardClient({ fetcher: createDemoFetcher(loadSnapshot) })
  : createBoardClient({ baseUrl: readAddresses().instanceUrl, onUnauthorized: askForTheWayIn })
