import { board } from '@/technical/Api/Board'
import { useResource, type Resource } from '@/technical/Api/UseResource'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import type { Tag } from '@contract/EpicContract'
import type { BoardUserSheet } from '@contract/ProjectContract'

export type Person = {
  login: string
  displayName: string
  capacity: number | null
  active: boolean
}

export type SubjectsData = {
  live: readonly EpicOverview[]
  trash: readonly EpicOverview[]
  people: readonly Person[]
  projects: readonly Project[]
  tags: readonly Tag[]
  self: string | null
}

async function readOr<T>(path: string, fallback: T): Promise<T> {
  try {
    return await board.read<T>(path)
  } catch {
    return fallback
  }
}

const OPEN = ['todo', 'doing', 'blocked']

export function peopleOf(users: readonly BoardUserSheet[], live: readonly EpicOverview[]): readonly Person[] {
  const holders = new Set(
    live.flatMap((subject) => (subject.assignee === null || !OPEN.includes(subject.state) ? [] : [subject.assignee])),
  )
  const listed: Person[] = users
    .filter((user) => user.active || holders.has(user.login))
    .map((user) => ({
      login: user.login,
      displayName: user.displayName,
      capacity: user.capacity,
      active: user.active,
    }))
  const known = new Set(users.map((user) => user.login))
  const others = [...new Set(live.flatMap((subject) => (subject.assignee === null ? [] : [subject.assignee])))]
    .filter((login) => !known.has(login))
    .sort((one, other) => one.localeCompare(other))
    .map((login) => ({ login, displayName: login, capacity: null, active: true }))
  return [...listed, ...others]
}

async function load(): Promise<SubjectsData> {
  const [live, projects, tags] = await Promise.all([
    board.read<readonly EpicOverview[]>('/api/epics'),
    board.read<readonly Project[]>('/api/projects'),
    readOr<readonly Tag[]>('/api/tags', []),
  ])
  const [trash, users, self] = await Promise.all([
    readOr<readonly EpicOverview[]>('/api/epics?state=trash', []),
    readOr<readonly BoardUserSheet[]>('/api/board-users', []),
    readOr<{ login: string } | null>('/api/board/self', null),
  ])
  return { live, trash, people: peopleOf(users, live), projects, tags, self: self?.login ?? null }
}

export function useSubjects(): Resource<SubjectsData> {
  return useResource(load)
}
