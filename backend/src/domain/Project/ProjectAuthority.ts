import { LOCAL_OPERATOR } from '../../technical/Auth/BoardIdentity.js'

export type ProjectAuthorityInput = {
  login: string
  adminUserId: number | null
  adminLogin: string | null
  isSuperAdmin: (login: string) => boolean
}

export function mayAdministerProject({ login, adminUserId, adminLogin, isSuperAdmin }: ProjectAuthorityInput): boolean {
  return adminUserId === null || login === LOCAL_OPERATOR || login === adminLogin || isSuperAdmin(login)
}
