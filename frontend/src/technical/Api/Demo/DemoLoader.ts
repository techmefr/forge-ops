import type { EpicStateChange, SubjectLink, Tag } from '@contract/EpicContract'
import type { ProjectEvent } from '@contract/EventContract'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import type { ProjectFollowUp } from '@contract/FollowUpContract'
import type { StoryThread } from '@contract/ConversationContract'
import type { BoardUserSheet, ProjectSheet } from '@contract/ProjectContract'
import type { EpicOverview, Project } from '@contract/StoryContract'
import type { ProjectWorkflow } from '@contract/WorkflowColumnContract'
import type { DemoState, FollowUpNote } from './DemoModel'

const RESERVED_IDENTIFIER_SPACE = 1000

function held<T>(snapshot: Record<string, unknown>, path: string, fallback: T): T {
  const found = snapshot[path]
  return found === undefined ? fallback : (found as T)
}

function threadIdentifiers(snapshot: Record<string, unknown>): readonly number[] {
  return Object.keys(snapshot).flatMap((path) => {
    const found = /^\/api\/stories\/(\d+)\/thread$/.exec(path)
    return found === null ? [] : [Number(found[1])]
  })
}

function highest(numbers: readonly number[]): number {
  return numbers.reduce((top, value) => Math.max(top, value), 0)
}

export function createDemoState(source: Record<string, unknown>): DemoState {
  const snapshot = structuredClone(source)
  const projects = held<Project[]>(snapshot, '/api/projects', [])
  const epics = [
    ...held<EpicOverview[]>(snapshot, '/api/epics', []),
    ...held<EpicOverview[]>(snapshot, '/api/epics?state=trash', []),
  ]
  const events: ProjectEvent[] = []
  const links = new Map<number, SubjectLink[]>()
  const columns = []
  const cards: ForgeCardView[] = []
  const risks = []
  const decisions = []
  const notes = new Map<number, FollowUpNote>()

  for (const project of projects) {
    events.push(...held<ProjectEvent[]>(snapshot, `/api/projects/${project.id}/events`, []))
    links.set(project.id, held<SubjectLink[]>(snapshot, `/api/projects/${project.id}/links`, []))
    columns.push(...held<ProjectWorkflow>(snapshot, `/api/projects/${project.id}/workflow-columns`, { columns: [] } as unknown as ProjectWorkflow).columns)
    cards.push(...held<ForgeCardView[]>(snapshot, `/api/forge-cards?project=${project.id}`, []))
    const followUp = snapshot[`/api/projects/${project.id}/follow-up`] as ProjectFollowUp | undefined
    if (followUp !== undefined) {
      risks.push(...followUp.risks)
      decisions.push(...followUp.decisions)
      notes.set(project.id, {
        statusSentence: followUp.statusSentence,
        manual: followUp.source === 'manual' ? followUp.weather : null,
      })
    }
  }

  const history = new Map<number, EpicStateChange[]>()
  for (const epic of epics) {
    history.set(epic.id, held<EpicStateChange[]>(snapshot, `/api/epics/${epic.id}/history`, []))
  }

  const threads = new Map<number, StoryThread>()
  for (const storyId of threadIdentifiers(snapshot)) {
    threads.set(storyId, held<StoryThread>(snapshot, `/api/stories/${storyId}/thread`, undefined as never))
  }

  const sheets = held<ProjectSheet[]>(snapshot, '/api/projects/sheets', [])
  const users = held<BoardUserSheet[]>(snapshot, '/api/board-users', [])
  const tags = held<Tag[]>(snapshot, '/api/tags', [])

  return {
    singletons: snapshot,
    self: held(snapshot, '/api/board/self', { login: 'local', superAdmin: false }),
    projects,
    sheets,
    users,
    tags,
    epics,
    history,
    events,
    risks,
    decisions,
    notes,
    links,
    columns,
    cards,
    threads,
    failedOnce: new Set(),
    generation: new Map(),
    sequence:
      RESERVED_IDENTIFIER_SPACE +
      highest([
        ...projects.map((project) => project.id),
        ...epics.map((epic) => epic.id),
        ...events.map((event) => event.id),
        ...risks.map((risk) => risk.id),
        ...decisions.map((decision) => decision.id),
        ...columns.map((column) => column.id),
        ...cards.map((card) => card.id),
        ...cards.map((card) => card.storyId),
        ...users.map((user) => user.id),
        ...tags.map((tag) => tag.id),
      ]),
  }
}
