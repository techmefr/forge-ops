import { SCREENS, type Screen } from './Screen.js'

export function assignLetters(labels: readonly string[]): readonly string[] {
  const taken = new Set<string>()
  return labels.map((label) => {
    const candidates = [...label.toUpperCase()].filter((character) => /^[A-Z]$/.test(character))
    const free = candidates.find((character) => !taken.has(character))
    if (free === undefined) {
      return ''
    }
    taken.add(free)
    return free
  })
}

export function screenOfLetter(letter: string): Screen | null {
  if (!/^[A-Za-z]$/.test(letter)) {
    return null
  }
  const wanted = letter.toUpperCase()
  return SCREENS.find((screen) => screen.letter === wanted) ?? null
}
