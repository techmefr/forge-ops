import type { EpicStateChange, SubjectLink, Tag } from '@contract/EpicContract'
import type { ProjectEvent } from '@contract/EventContract'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import type { ProjectDecision, ProjectRisk, Weather } from '@contract/FollowUpContract'
import type { BoardUserSheet, ProjectSheet } from '@contract/ProjectContract'
import type { EpicOverview, Project } from '@contract/StoryContract'
import type { StoryThread } from '@contract/ConversationContract'
import type { WorkflowAdmin, WorkflowColumn } from '@contract/WorkflowColumnContract'

export type DemoReply = { status: number; body: unknown }

export type DemoEvent = { name: string; payload: Record<string, unknown> }

export type DemoEnvironment = {
  emit: (event: DemoEvent) => void
  later: (delayMs: number, work: () => void) => void
  now: () => Date
}

export type FollowUpNote = {
  statusSentence: string | null
  manual: Weather | null
}

export type DemoState = {
  singletons: Record<string, unknown>
  self: { login: string; superAdmin: boolean }
  projects: Project[]
  sheets: ProjectSheet[]
  users: BoardUserSheet[]
  tags: Tag[]
  epics: EpicOverview[]
  history: Map<number, EpicStateChange[]>
  events: ProjectEvent[]
  risks: ProjectRisk[]
  decisions: ProjectDecision[]
  notes: Map<number, FollowUpNote>
  links: Map<number, SubjectLink[]>
  columns: WorkflowColumn[]
  cards: ForgeCardView[]
  threads: Map<number, StoryThread>
  failedOnce: Set<number>
  generation: Map<number, number>
  sequence: number
}

export function reply(body: unknown, status = 200): DemoReply {
  return { status, body }
}

export function refusal(status: number, error: string, message: string): DemoReply {
  return { status, body: { error, message } }
}

export function nextIdentifier(state: DemoState): number {
  state.sequence += 1
  return state.sequence
}

export function dayOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function adminOf(state: DemoState, projectId: number): WorkflowAdmin | null {
  const sheet = state.sheets.find((candidate) => candidate.id === projectId)
  if (sheet === undefined || sheet.adminLogin === null) {
    return null
  }
  return { login: sheet.adminLogin, name: sheet.adminName ?? sheet.adminLogin }
}

export function bodyText(body: Record<string, unknown>, key: string): string | null {
  const value = body[key]
  return typeof value === 'string' ? value : null
}

export function bodyNumber(body: Record<string, unknown>, key: string): number | null {
  const value = body[key]
  return typeof value === 'number' ? value : null
}

export type DemoContext = {
  state: DemoState
  env: DemoEnvironment
  match: RegExpExecArray
  query: URLSearchParams
  body: Record<string, unknown>
}

export type DemoRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  pattern: RegExp
  run: (context: DemoContext) => DemoReply
}

export function route(method: DemoRoute['method'], path: string, run: DemoRoute['run']): DemoRoute {
  return { method, pattern: new RegExp(`^${path}$`), run }
}

export function identifierAt(context: DemoContext, position = 1): number {
  return Number(context.match[position])
}
