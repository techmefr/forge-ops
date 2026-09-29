import { board } from '@/technical/Api/Board'
import { useResource, type Resource } from '@/technical/Api/UseResource'
import type { Project } from '@/domain/Board/BoardModel'
import type { ProjectFollowUp } from '@contract/FollowUpContract'

export type ProjectWeather = {
  project: Project
  followUp: ProjectFollowUp
}

async function loadFollowUp(project: Project): Promise<ProjectWeather> {
  const followUp = await board.read<ProjectFollowUp>(`/api/projects/${project.id}/follow-up`)
  return { project, followUp }
}

export function useFollowUps(): Resource<readonly ProjectWeather[]> {
  return useResource(async () => {
    const projects = await board.read<readonly Project[]>('/api/projects')
    return Promise.all(projects.map(loadFollowUp))
  })
}
