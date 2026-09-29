import type { Project } from '@/domain/Board/BoardModel'

export type PickerOption =
  | { kind: 'all' }
  | { kind: 'project'; project: Project }
  | { kind: 'create'; name: string }

export type PickerInput = {
  projects: readonly Project[]
  query: string
  showAll: boolean
  creatable: boolean
}

const NAME_LIMIT = 80

function normalised(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export function optionsOf({ projects, query, showAll, creatable }: PickerInput): readonly PickerOption[] {
  const wanted = normalised(query)
  const matching = projects.filter((project) => wanted === '' || normalised(project.name).includes(wanted))
  const options: PickerOption[] = []
  if (showAll && wanted === '') {
    options.push({ kind: 'all' })
  }
  options.push(...matching.map((project): PickerOption => ({ kind: 'project', project })))
  const typed = query.trim().slice(0, NAME_LIMIT)
  const exists = projects.some((project) => normalised(project.name) === wanted)
  if (creatable && typed !== '' && !exists) {
    options.push({ kind: 'create', name: typed })
  }
  return options
}

export function stepIndex(current: number, count: number, direction: 1 | -1): number {
  if (count === 0) {
    return -1
  }
  if (current < 0) {
    return direction === 1 ? 0 : count - 1
  }
  return (current + direction + count) % count
}

export function optionKey(option: PickerOption): string {
  switch (option.kind) {
    case 'all':
      return 'all'
    case 'create':
      return 'create'
    case 'project':
      return `project-${option.project.id}`
  }
}
