import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { BoardUserSheet } from '../../../../contract/ProjectContract.js'
import { IDENTITY_COOKIE } from '../../technical/Auth/TokenGuard.js'
import type { BoardUser } from './Identity.js'
import type { IdentityRepository } from './IdentityRepository.js'

export const SETUP_TOKEN_HEADER = 'x-forge-setup-token'
export const DESKTOP_CLIENT_HEADER = 'x-forge-client'
export const DESKTOP_CLIENT_VALUE = 'desktop'

export type CallerOf = (context: Context) => BoardUser | null

export function sheetOf(user: BoardUser): BoardUserSheet {
  return {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    role: user.role,
    superAdmin: user.superAdmin,
    active: user.active,
    capacity: user.capacity,
  }
}

export function createCallerOf(identities: Pick<IdentityRepository, 'readSession'>): CallerOf {
  return (context) => {
    const sessionToken = context.req.header('x-forge-identity') ?? getCookie(context, IDENTITY_COOKIE)
    return sessionToken === undefined || sessionToken === '' ? null : identities.readSession(sessionToken)
  }
}
