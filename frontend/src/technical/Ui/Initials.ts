const TONES = ['acc', 'info', 'green', 'orange', 'violet'] as const

export type AvatarTone = (typeof TONES)[number]

export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter((word) => word !== '')
  if (words.length === 0) {
    return '?'
  }
  const first = words[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : ''
  return `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`.toUpperCase()
}

export function toneOf(name: string): AvatarTone {
  let hash = 0
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 997
  }
  return TONES[hash % TONES.length] ?? 'acc'
}
