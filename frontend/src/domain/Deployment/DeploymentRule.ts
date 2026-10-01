import { activeProjectOf } from '@/domain/Forge/ForgeRule'

export const FALLBACK_INTEGRATION_BRANCH = 'forge'

export function integrationBranchOf(
  projects: readonly { id: number; integrationBranch: string }[],
  remembered: string,
): string {
  const activeId = activeProjectOf(projects, remembered)
  return projects.find((project) => project.id === activeId)?.integrationBranch ?? FALLBACK_INTEGRATION_BRANCH
}
