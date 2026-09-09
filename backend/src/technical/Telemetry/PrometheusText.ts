export type MetricSample = {
  name: string
  labels: Readonly<Record<string, string>>
  value: number
}

const SAMPLE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?[0-9.eE+]+|[+-]?Inf|NaN)(?:\s+\d+)?$/

const LABEL = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g

function labelsOf(raw: string | undefined): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {}
  for (const found of (raw ?? '').matchAll(LABEL)) {
    const [, name, value] = found
    if (name !== undefined && value !== undefined) {
      labels[name] = value.replace(/\\"/g, '"')
    }
  }
  return labels
}

export function parseExposition(text: string): readonly MetricSample[] {
  const samples: MetricSample[] = []
  for (const line of text.split('\n')) {
    const found = SAMPLE.exec(line.trim())
    if (found === null) {
      continue
    }
    const [, name, labels, raw] = found
    const value = Number(raw)
    if (name === undefined || !Number.isFinite(value)) {
      continue
    }
    samples.push({ name, labels: labelsOf(labels), value })
  }
  return samples
}

export function sampleOf(
  samples: readonly MetricSample[],
  name: string,
  labels: Readonly<Record<string, string>> = {},
): MetricSample | null {
  return (
    samples.find(
      (sample) =>
        sample.name === name &&
        Object.entries(labels).every(([key, value]) => sample.labels[key] === value),
    ) ?? null
  )
}

export function sumOf(samples: readonly MetricSample[], name: string): number {
  return samples
    .filter((sample) => sample.name === name)
    .reduce((total, sample) => total + sample.value, 0)
}
