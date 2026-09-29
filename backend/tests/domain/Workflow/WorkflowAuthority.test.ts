import { describe, expect, it } from 'vitest'
import { mayAdministerWorkflow } from '../../../src/domain/Workflow/WorkflowAuthority.js'

const NOBODY_IS_SUPER = (): boolean => false

describe('mayAdministerWorkflow', () => {
  it('lets the project admin settle the workflow', () => {
    expect(mayAdministerWorkflow({ login: 'ana', adminLogin: 'ana', isSuperAdmin: NOBODY_IS_SUPER })).toBe(true)
  })

  it('lets a super admin settle the workflow of any project', () => {
    expect(
      mayAdministerWorkflow({ login: 'root', adminLogin: 'ana', isSuperAdmin: (login) => login === 'root' }),
    ).toBe(true)
  })

  it('lets the local operator settle it on a single-user board', () => {
    expect(mayAdministerWorkflow({ login: 'local', adminLogin: null, isSuperAdmin: NOBODY_IS_SUPER })).toBe(true)
  })

  it('refuses another member', () => {
    expect(mayAdministerWorkflow({ login: 'bob', adminLogin: 'ana', isSuperAdmin: NOBODY_IS_SUPER })).toBe(false)
  })

  it('refuses everyone but a super admin while the project has no admin', () => {
    expect(mayAdministerWorkflow({ login: 'bob', adminLogin: null, isSuperAdmin: NOBODY_IS_SUPER })).toBe(false)
  })
})
