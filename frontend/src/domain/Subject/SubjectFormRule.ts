import {
  DEFAULT_EPIC_PRIORITY,
  type EpicPriority,
  type LinkKind,
  type ManualEpicState,
  type SubjectLink,
} from '@contract/EpicContract'
import type { EpicOverview } from '@/domain/Board/BoardModel'

export const TITLE_LIMIT = 200
export const NOTE_LIMIT = 600
export const REQUESTED_BY_LIMIT = 120

export type LinkDraft = { kind: LinkKind; url: string }

export type SubjectForm = {
  title: string
  projectId: number | null
  owner: string
  priority: EpicPriority
  requestedBy: string
  startedOn: string
  milestone: string
  note: string
  tagIds: readonly number[]
  links: readonly LinkDraft[]
  dependsOn: readonly number[]
}

export type FieldName = 'title' | 'project' | 'milestone' | 'note' | 'links' | 'requestedBy'

export type FormIssue = { field: FieldName; message: string }

export type MilestoneStep = 'none' | 'create' | 'change' | 'remove'

export const FIELD_ORDER: readonly FieldName[] = ['title', 'project', 'requestedBy', 'milestone', 'note', 'links']

export function emptyForm(projectId: number | null): SubjectForm {
  return {
    title: '',
    projectId,
    owner: '',
    priority: DEFAULT_EPIC_PRIORITY,
    requestedBy: '',
    startedOn: '',
    milestone: '',
    note: '',
    tagIds: [],
    links: [],
    dependsOn: [],
  }
}

export function formOf(subject: EpicOverview, milestone: string | null): SubjectForm {
  return {
    title: subject.title,
    projectId: subject.projectId,
    owner: subject.assignee ?? '',
    priority: subject.priority,
    requestedBy: subject.requestedBy ?? '',
    startedOn: subject.startedOn ?? '',
    milestone: milestone ?? '',
    note: subject.statusNote ?? '',
    tagIds: subject.tags.map((tag) => tag.id),
    links: subject.links.map((link) => ({ kind: link.kind, url: link.url })),
    dependsOn: [...subject.dependsOn],
  }
}

export function isWebAddress(value: string): boolean {
  try {
    const address = new URL(value.trim())
    return address.protocol === 'http:' || address.protocol === 'https:'
  } catch {
    return false
  }
}

export function issuesOf(form: SubjectForm): readonly FormIssue[] {
  const issues: FormIssue[] = []
  if (form.title.trim() === '') {
    issues.push({ field: 'title', message: 'subjects.form.errors.titleRequired' })
  }
  if (form.projectId === null) {
    issues.push({ field: 'project', message: 'subjects.form.errors.projectRequired' })
  }
  if (form.startedOn !== '' && form.milestone !== '' && form.milestone < form.startedOn) {
    issues.push({ field: 'milestone', message: 'subjects.form.errors.milestoneBeforeStart' })
  }
  if (form.note.trim().length > NOTE_LIMIT) {
    issues.push({ field: 'note', message: 'subjects.form.errors.noteTooLong' })
  }
  if (form.links.some((link) => link.url.trim() !== '' && !isWebAddress(link.url))) {
    issues.push({ field: 'links', message: 'subjects.form.errors.linkInvalid' })
  }
  return issues
}

export function linksOf(form: SubjectForm): readonly SubjectLink[] {
  return form.links
    .filter((link) => link.url.trim() !== '')
    .map((link) => ({ kind: link.kind, url: link.url.trim() }))
}

function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

export function changesOf(form: SubjectForm): Record<string, unknown> {
  return {
    title: form.title.trim(),
    priority: form.priority,
    startedOn: form.startedOn === '' ? null : form.startedOn,
    statusNote: blankToNull(form.note),
    requestedBy: blankToNull(form.requestedBy),
    tagIds: [...form.tagIds],
    links: linksOf(form),
    dependsOn: [...form.dependsOn],
  }
}

export function creationOf(form: SubjectForm): Record<string, unknown> {
  return {
    projectId: form.projectId,
    assignee: form.owner === '' ? null : form.owner,
    ...changesOf(form),
  }
}

export function stateAfterOwnerChange(subject: EpicOverview, owner: string): ManualEpicState | null {
  if (subject.storyCount > 0 || (subject.assignee ?? '') === owner) {
    return null
  }
  if (owner !== '' && subject.state === 'todo') {
    return 'doing'
  }
  if (owner === '' && subject.state === 'doing') {
    return 'todo'
  }
  return null
}

export function milestoneStep(existing: string | null, wanted: string): MilestoneStep {
  if (existing === null) {
    return wanted === '' ? 'none' : 'create'
  }
  if (wanted === '') {
    return 'remove'
  }
  return existing === wanted ? 'none' : 'change'
}

export function firstIssueField(issues: readonly FormIssue[]): FieldName | null {
  return FIELD_ORDER.find((field) => issues.some((issue) => issue.field === field)) ?? null
}

export function toggled(ids: readonly number[], id: number): readonly number[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
}

export function dependencyCandidates(
  subjects: readonly EpicOverview[],
  selfId: number | null,
  picked: readonly number[],
): readonly EpicOverview[] {
  return subjects.filter(
    (subject) => subject.id !== selfId && subject.deletedAt === null && !picked.includes(subject.id),
  )
}
