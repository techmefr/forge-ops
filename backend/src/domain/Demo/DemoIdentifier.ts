const IDENTIFIER_KEYS = ['id', 'storyId', 'projectId', 'epicId', 'twinId']

function collect(value: unknown, found: Set<string>, depth: number): void {
  if (depth > 12 || value === null || typeof value !== 'object') {
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, found, depth + 1)
    }
    return
  }
  for (const [key, held] of Object.entries(value)) {
    if (IDENTIFIER_KEYS.includes(key) && (typeof held === 'string' || typeof held === 'number')) {
      const identifier = String(held)
      if (identifier !== '' && /^[A-Za-z0-9_-]+$/.test(identifier)) {
        found.add(identifier)
      }
      continue
    }
    collect(held, found, depth + 1)
  }
}

export function identifiersIn(payloads: readonly unknown[]): readonly string[] {
  const found = new Set<string>()
  for (const payload of payloads) {
    collect(payload, found, 0)
  }
  return [...found].sort()
}
