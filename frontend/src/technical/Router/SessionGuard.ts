import type { NavigationGuard } from 'vue-router'
import { LOGIN_PATH } from '@/technical/Api/Board'

export type SessionCheck = () => Promise<boolean>

export function createSessionGuard(checkSession: SessionCheck): NavigationGuard {
  return async (to) => {
    if (to.path === LOGIN_PATH) {
      return true
    }
    return (await checkSession()) ? true : { path: LOGIN_PATH }
  }
}
