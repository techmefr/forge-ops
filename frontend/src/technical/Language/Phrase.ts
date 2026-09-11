export type Phrase = {
  key: string
  values: Readonly<Record<string, string | number>>
  count: number | null
}

export function verbatim(text: string): Phrase {
  return { key: text, values: {}, count: null }
}

export function phrase(
  key: string,
  values: Readonly<Record<string, string | number>> = {},
  count: number | null = null,
): Phrase {
  return { key, values, count }
}
