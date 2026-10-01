import { LOCAL_OPERATOR } from '../../technical/Auth/BoardIdentity.js'

export type ProjectAuthorityInput = {
  login: string
  adminLogin: string | null
  isSuperAdmin: (login: string) => boolean
  isDirector: (login: string) => boolean
}

export function mayAdministerProject({ login, adminLogin, isSuperAdmin, isDirector }: ProjectAuthorityInput): boolean {
  if (login === LOCAL_OPERATOR || isSuperAdmin(login)) {
    return true
  }
  return adminLogin === null ? isDirector(login) : login === adminLogin
}
