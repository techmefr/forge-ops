import { createBoardClient } from './BoardClient.js'

export const LOGIN_PATH = '/login'

function askForTheWayIn(): void {
  if (typeof window === 'undefined' || window.location.pathname === LOGIN_PATH) {
    return
  }
  window.location.assign(LOGIN_PATH)
}

export const board = createBoardClient({ onUnauthorized: askForTheWayIn })
