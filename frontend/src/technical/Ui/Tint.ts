export function tintOf(colour: string): string {
  const named = colour.trim()
  if (named === '') {
    return 'var(--forge-line)'
  }
  return named.startsWith('#') || named.startsWith('rgb') ? named : `var(--forge-${named})`
}
