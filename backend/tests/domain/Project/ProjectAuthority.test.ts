import { describe, expect, it } from 'vitest'
import { mayAdministerProject } from '../../../src/domain/Project/ProjectAuthority.js'

function input(login: string, adminLogin: string | null, over: { superAdmin?: string; director?: string } = {}) {
  return {
    login,
    adminLogin,
    isSuperAdmin: (who: string) => who === over.superAdmin,
    isDirector: (who: string) => who === over.director,
  }
}

describe('mayAdministerProject', () => {
  it('lets the project admin administer it', () => {
    expect(mayAdministerProject(input('ana', 'ana'))).toBe(true)
  })

  it('lets a super admin administer any project', () => {
    expect(mayAdministerProject(input('root', 'ana', { superAdmin: 'root' }))).toBe(true)
    expect(mayAdministerProject(input('root', null, { superAdmin: 'root' }))).toBe(true)
  })

  it('lets the local operator administer it', () => {
    expect(mayAdministerProject(input('local', null))).toBe(true)
    expect(mayAdministerProject(input('local', 'ana'))).toBe(true)
  })

  it('refuses another member, a director included, while the project has an admin', () => {
    expect(mayAdministerProject(input('bob', 'ana'))).toBe(false)
    expect(mayAdministerProject(input('dir', 'ana', { director: 'dir' }))).toBe(false)
  })

  it('leaves a project without admin to a director or a super admin only', () => {
    expect(mayAdministerProject(input('dir', null, { director: 'dir' }))).toBe(true)
    expect(mayAdministerProject(input('bob', null))).toBe(false)
  })
})
