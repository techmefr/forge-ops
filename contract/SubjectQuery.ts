import { inSubjectFilter, UNASSIGNED, type EpicQuery } from './EpicContract.js'
import type { EpicOverview } from './StoryContract.js'

function haystackOf(epic: EpicOverview): string {
  return [epic.title, epic.businessIntent, epic.statusNote ?? '', epic.requestedBy ?? ''].join('\n').toLowerCase()
}

export function matchesQuery(epic: EpicOverview, query: EpicQuery): boolean {
  if (query.project !== undefined && epic.projectId !== query.project) {
    return false
  }
  if (query.assignee !== undefined) {
    const wanted = query.assignee === UNASSIGNED ? null : query.assignee
    if (epic.assignee !== wanted) {
      return false
    }
  }
  if (query.tag !== undefined && !epic.tags.some((tag) => tag.id === query.tag)) {
    return false
  }
  if (query.state !== undefined && !inSubjectFilter(epic, query.state)) {
    return false
  }
  return query.q === undefined || haystackOf(epic).includes(query.q.toLowerCase())
}
