import type { Context } from 'hono'
import type { IdentityRepository } from '../domain/Identity/IdentityRepository.js'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import { mayAdministerProject } from '../domain/Project/ProjectAuthority.js'
import { operatorOf } from '../technical/Auth/BoardIdentity.js'

export type BoardAccess = {
  isSuperAdmin: (login: string) => boolean
  isDirector: (login: string) => boolean
  mayRunTheBoard: (context: Context) => boolean
  maySettle: (context: Context) => boolean
  mayAdminister: (projectId: number, context: Context) => boolean
}

export function createBoardAccess({
  identities,
  stories,
  mode,
}: {
  identities: Pick<IdentityRepository, 'findUser'>
  stories: Pick<StoryRepository, 'projects'>
  mode: 'local' | 'hub'
}): BoardAccess {
  const isSuperAdmin = (login: string): boolean => identities.findUser(login)?.superAdmin ?? false
  const isDirector = (login: string): boolean => identities.findUser(login)?.role === 'director'

  return {
    isSuperAdmin,
    isDirector,
    mayRunTheBoard: (context) => mode === 'local' || isSuperAdmin(operatorOf(context)) || isDirector(operatorOf(context)),
    maySettle: (context) => mode === 'local' || isDirector(operatorOf(context)),
    mayAdminister: (projectId, context) =>
      mayAdministerProject({
        login: operatorOf(context),
        adminLogin: stories.projects.find(projectId)?.adminLogin ?? null,
        isSuperAdmin,
        isDirector,
      }),
  }
}
