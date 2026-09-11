export const BRACKET_DEPTHS = 5

export const INDENT_WIDTH = 2

const OPENING = '([{'
const CLOSING = ')]}'

function guidesOf(spaces: string): string {
  const steps = Math.floor(spaces.length / INDENT_WIDTH)
  const rest = spaces.slice(steps * INDENT_WIDTH)
  const guides = Array.from(
    { length: steps },
    (_, step) =>
      `<span class="ind ind-${step % BRACKET_DEPTHS}">${' '.repeat(INDENT_WIDTH)}</span>`,
  ).join('')
  return `${guides}${rest}`
}

function bracketedOf(line: string, from: number): { said: string; depth: number } {
  let said = ''
  let depth = from
  let insideTag = false

  for (const sign of line) {
    if (insideTag) {
      said += sign
      insideTag = sign !== '>'
      continue
    }
    if (sign === '<') {
      said += sign
      insideTag = true
      continue
    }
    if (OPENING.includes(sign)) {
      said += `<span class="brk brk-${depth % BRACKET_DEPTHS}">${sign}</span>`
      depth += 1
      continue
    }
    if (CLOSING.includes(sign)) {
      depth = Math.max(depth - 1, 0)
      said += `<span class="brk brk-${depth % BRACKET_DEPTHS}">${sign}</span>`
      continue
    }
    said += sign
  }

  return { said, depth }
}

export function decoratedOf(html: string): string {
  let depth = 0
  return html
    .split('\n')
    .map((line) => {
      const spaces = /^ +/.exec(line)?.[0] ?? ''
      const bracketed = bracketedOf(line.slice(spaces.length), depth)
      depth = bracketed.depth
      return `${guidesOf(spaces)}${bracketed.said}`
    })
    .join('\n')
}
