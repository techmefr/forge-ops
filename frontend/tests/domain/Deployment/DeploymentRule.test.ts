import { describe, expect, it } from 'vitest'
import { FALLBACK_INTEGRATION_BRANCH, integrationBranchOf } from '@/domain/Deployment/DeploymentRule'

const PROJECTS = [
  { id: 1, integrationBranch: 'main' },
  { id: 2, integrationBranch: 'develop' },
]

describe('integrationBranchOf', () => {
  it('uses the integration branch of the remembered project', () => {
    expect(integrationBranchOf(PROJECTS, '2')).toBe('develop')
  })

  it('falls back to the first project when nothing is remembered', () => {
    expect(integrationBranchOf(PROJECTS, '')).toBe('main')
  })

  it('falls back to the default branch without projects', () => {
    expect(integrationBranchOf([], '')).toBe(FALLBACK_INTEGRATION_BRANCH)
  })
})
