import { board } from '@/technical/Api/Board'
import { useResource, type Resource } from '@/technical/Api/UseResource'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import type { SubjectLink } from '@contract/EpicContract'
import type { ProjectEvent } from '@contract/EventContract'
import type { RoadmapSubject } from './Timeline'

export type RoadmapProject = {
  project: Project
  subjects: readonly RoadmapSubject[]
  events: readonly ProjectEvent[]
  links: readonly SubjectLink[]
}

export function subjectOf(epic: EpicOverview): RoadmapSubject {
  return {
    id: epic.id,
    title: epic.title,
    assignee: epic.assignee,
    startedOn: epic.startedOn,
    state: epic.state,
  }
}

async function loadProject(project: Project): Promise<RoadmapProject> {
  const [epics, events, links] = await Promise.all([
    board.read<readonly EpicOverview[]>(`/api/projects/${project.id}/epics`),
    board.read<readonly ProjectEvent[]>(`/api/projects/${project.id}/events`),
    board.read<readonly SubjectLink[]>(`/api/projects/${project.id}/links`),
  ])
  return { project, subjects: epics.map(subjectOf), events, links }
}

export function useRoadmap(): Resource<readonly RoadmapProject[]> {
  return useResource(async () => {
    const projects = await board.read<readonly Project[]>('/api/projects')
    return Promise.all(projects.map(loadProject))
  })
}
