import { LOCAL_OPERATOR } from '../../technical/Auth/BoardIdentity.js'

export type WorkflowAuthorityInput = {
  login: string
  adminLogin: string | null
  isSuperAdmin: (login: string) => boolean
}

export function mayAdministerWorkflow({ login, adminLogin, isSuperAdmin }: WorkflowAuthorityInput): boolean {
  return login === LOCAL_OPERATOR || (adminLogin !== null && login === adminLogin) || isSuperAdmin(login)
}
