export type FileMark = 'quiet' | 'planned' | 'created' | 'ready' | 'deleted' | 'merged'

export type MarkTone = {
  label: string
  dot: string
  text: string
}

export const MARK_TONES: Readonly<Record<FileMark, MarkTone>> = {
  quiet: { label: '', dot: 'bg-line', text: 'text-txt-low' },
  planned: { label: 'Va être modifié', dot: 'bg-orange', text: 'text-orange' },
  created: { label: 'Sera créé', dot: 'bg-violet', text: 'text-violet' },
  ready: { label: 'Fini, pas encore mergé', dot: 'bg-green', text: 'text-green' },
  deleted: { label: 'Supprimé', dot: 'bg-red', text: 'text-red' },
  merged: { label: 'Livré', dot: 'bg-acc', text: 'text-txt-mid' },
}

export type Crumb = {
  label: string
  path: string
}

export function toneOf(mark: string): MarkTone {
  return MARK_TONES[mark as FileMark] ?? MARK_TONES.quiet
}

export function crumbsOf(path: string): readonly Crumb[] {
  const segments = path.split('/').filter((segment) => segment !== '')
  return [
    { label: 'racine', path: '' },
    ...segments.map((segment, depth) => ({
      label: segment,
      path: segments.slice(0, depth + 1).join('/'),
    })),
  ]
}
