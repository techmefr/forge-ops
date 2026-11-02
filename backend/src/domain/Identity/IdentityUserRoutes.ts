import type { Hono } from 'hono'
import { boardUserChangeSchema, boardUserDraftSchema } from '../../../../contract/ProjectContract.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import type { IdentityApiInput } from './IdentityApi.js'
import { sheetOf, type CallerOf } from './IdentityApiSupport.js'
import { UnknownAccountError } from './IdentityViolation.js'

export function mountIdentityUserRoutes(
  api: Hono,
  { identities, callerOf }: Pick<IdentityApiInput, 'identities'> & { callerOf: CallerOf },
): void {
  api.get('/api/board-users', (context) => context.json(identities.listUsers().map(sheetOf)))

  api.post('/api/board-users', async (context) => {
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    if (!user.superAdmin && user.role !== 'director') {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    const draft = await parseBody(context, boardUserDraftSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidBoardUser', issues: draft.error.issues }, 422)
    }
    return context.json(sheetOf(identities.enrolUser(draft.data)), 201)
  })

  api.patch('/api/board-users/:login', async (context) => {
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    const login = context.req.param('login')
    const draft = await parseBody(context, boardUserChangeSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidBoardUserChange', issues: draft.error.issues }, 422)
    }
    const change = draft.data
    if (change.superAdmin !== undefined && !user.superAdmin) {
      return context.json({ error: 'SuperAdminRequired' }, 403)
    }
    const manages = user.superAdmin || user.role === 'director'
    if (change.active !== undefined && !manages) {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    if (change.capacity !== undefined && !manages && user.login !== login) {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    let changed = identities.findUser(login)
    if (changed === null) {
      throw new UnknownAccountError(login)
    }
    if (change.active !== undefined && changed.superAdmin && !user.superAdmin) {
      return context.json({ error: 'SuperAdminRequired' }, 403)
    }
    if (change.superAdmin !== undefined) {
      changed = identities.changeSuperAdmin(login, change.superAdmin)
    }
    if (change.active !== undefined) {
      changed = identities.changeActive(login, change.active)
    }
    if (change.capacity !== undefined) {
      changed = identities.changeCapacity(login, change.capacity)
    }
    return context.json(sheetOf(changed))
  })

  api.post('/api/board-users/:login/verify-email', (context) => {
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    if (!user.superAdmin && user.role !== 'director') {
      return context.json({ error: 'DirectorRequired' }, 403)
    }
    return context.json(sheetOf(identities.verifyEmail(context.req.param('login'))))
  })

  api.post('/api/board-users/:login/erase', (context) => {
    const user = callerOf(context)
    if (user === null) {
      return context.json({ error: 'UnauthenticatedAccount' }, 401)
    }
    if (!user.superAdmin) {
      return context.json({ error: 'SuperAdminRequired' }, 403)
    }
    return context.json(sheetOf(identities.eraseUser(context.req.param('login'))))
  })
}
