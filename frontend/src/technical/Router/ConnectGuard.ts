import type { NavigationGuard } from 'vue-router'

export const CONNECT_PATH = '/connect'

export function createConnectGuard(isDesktop: boolean, isConnected: () => boolean): NavigationGuard {
  return (to) => {
    if (!isDesktop || to.path === CONNECT_PATH || isConnected()) {
      return true
    }
    return { path: CONNECT_PATH }
  }
}
