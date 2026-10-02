import { board } from '@/technical/Api/Board'
import { useResource, type Resource } from '@/technical/Api/UseResource'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import type { ProjectFollowUp } from '@contract/FollowUpContract'

export type SubjectTally = {
  open: number
  done: number
  total: number
}

export type ProjectWeather = {
  project: Project
  followUp: ProjectFollowUp
  tally: SubjectTally
}

function tallyOf(subjects: readonly EpicOverview[], projectId: number): SubjectTally {
  const own = subjects.filter((subject) => subject.projectId === projectId)
  const done = own.filter((subject) => subject.state === 'done').length
  return { open: own.length - done, done, total: own.length }
}

async function loadFollowUp(project: Project, subjects: readonly EpicOverview[]): Promise<ProjectWeather> {
  const followUp = await board.read<ProjectFollowUp>(`/api/projects/${project.id}/follow-up`)
  return { project, followUp, tally: tallyOf(subjects, project.id) }
}

export function useFollowUps(): Resource<readonly ProjectWeather[]> {
  return useResource(async () => {
    const [projects, subjects] = await Promise.all([
      board.read<readonly Project[]>('/api/projects'),
      board.read<readonly EpicOverview[]>('/api/epics'),
    ])
    return Promise.all(projects.map((project) => loadFollowUp(project, subjects)))
  })
}
