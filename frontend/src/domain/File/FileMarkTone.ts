export const FILE_MARK_SEQUENCE = [
  'quiet',
  'planned',
  'created',
  'ready',
  'deleted',
  'merged',
] as const

export type FileMark = (typeof FILE_MARK_SEQUENCE)[number]

export type MarkTone = {
  mark: FileMark
  dot: string
  text: string
}

export const MARK_TONES: Readonly<Record<FileMark, MarkTone>> = {
  quiet: { mark: 'quiet', dot: 'bg-line', text: 'text-txt-low' },
  planned: { mark: 'planned', dot: 'bg-orange', text: 'text-orange' },
  created: { mark: 'created', dot: 'bg-violet', text: 'text-violet' },
  ready: { mark: 'ready', dot: 'bg-green', text: 'text-green' },
  deleted: { mark: 'deleted', dot: 'bg-red', text: 'text-red' },
  merged: { mark: 'merged', dot: 'bg-acc', text: 'text-txt-mid' },
}

export const SPOKEN_MARKS: readonly FileMark[] = FILE_MARK_SEQUENCE.filter(
  (mark) => mark !== 'quiet',
)

export type Crumb = {
  label: string
  path: string
  root: boolean
}

export function toneOf(mark: string): MarkTone {
  return MARK_TONES[mark as FileMark] ?? MARK_TONES.quiet
}

export function crumbsOf(path: string): readonly Crumb[] {
  const segments = path.split('/').filter((segment) => segment !== '')
  return [
    { label: '', path: '', root: true },
    ...segments.map((segment, depth) => ({
      label: segment,
      path: segments.slice(0, depth + 1).join('/'),
      root: false,
    })),
  ]
}
