export type ShellSegment = {
  words: string[]
  pipedFromPrevious: boolean
}

export class UnparseableShellError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'UnparseableShellError'
  }
}

const HARMLESS_REDIRECTS = ['2>&1', '>/dev/null', '2>/dev/null', '1>/dev/null', '&>/dev/null', '>&2'] as const

const FORBIDDEN_BARE = new Map<string, string>([
  ['$', 'variable and command substitution'],
  ['`', 'backtick command substitution'],
  ['\\', 'backslash escapes'],
  ['(', 'subshells'],
  [')', 'subshells'],
  ['{', 'brace expansion and groups'],
  ['}', 'brace expansion and groups'],
  ['<', 'input redirection and here-documents'],
  ['>', 'output redirection'],
  [';', 'command separators other than &&'],
  ['!', 'history expansion and negation'],
  ['\n', 'multi-line commands'],
  ['\r', 'multi-line commands'],
])

const FORBIDDEN_QUOTED = new Map<string, string>([
  ['$', 'variable and command substitution'],
  ['`', 'backtick command substitution'],
  ['\\', 'backslash escapes'],
])

function redirectAt(command: string, index: number): string | null {
  for (const redirect of HARMLESS_REDIRECTS) {
    if (!command.startsWith(redirect, index)) {
      continue
    }
    const next = command[index + redirect.length]
    if (next === undefined || next === ' ' || next === '\t') {
      return redirect
    }
  }
  return null
}

export function tokenizeShell(command: string): ShellSegment[] {
  if (command.trim() === '') {
    throw new UnparseableShellError('the command is empty')
  }
  if (command.includes('\0')) {
    throw new UnparseableShellError('the command contains a NUL byte')
  }

  const segments: ShellSegment[] = []
  let words: string[] = []
  let word = ''
  let inWord = false
  let pipedFromPrevious = false
  let index = 0

  function endWord(): void {
    if (inWord) {
      words.push(word)
    }
    word = ''
    inWord = false
  }

  function endSegment(nextIsPiped: boolean): void {
    endWord()
    if (words.length === 0) {
      throw new UnparseableShellError('an empty command sits next to a separator')
    }
    segments.push({ words, pipedFromPrevious })
    words = []
    pipedFromPrevious = nextIsPiped
  }

  while (index < command.length) {
    const char = command[index] as string

    if (char === "'") {
      const close = command.indexOf("'", index + 1)
      if (close === -1) {
        throw new UnparseableShellError('a single quote is never closed')
      }
      word += command.slice(index + 1, close)
      inWord = true
      index = close + 1
      continue
    }

    if (char === '"') {
      let cursor = index + 1
      let closed = false
      while (cursor < command.length) {
        const inner = command[cursor] as string
        if (inner === '"') {
          closed = true
          break
        }
        const forbidden = FORBIDDEN_QUOTED.get(inner)
        if (forbidden !== undefined) {
          throw new UnparseableShellError(`${forbidden} are not allowed`)
        }
        word += inner
        cursor += 1
      }
      if (!closed) {
        throw new UnparseableShellError('a double quote is never closed')
      }
      inWord = true
      index = cursor + 1
      continue
    }

    if (char === ' ' || char === '\t') {
      endWord()
      index += 1
      continue
    }

    if (!inWord) {
      const redirect = redirectAt(command, index)
      if (redirect !== null) {
        index += redirect.length
        continue
      }
      if (char === '#') {
        throw new UnparseableShellError('comments are not allowed')
      }
      if (char === '~') {
        throw new UnparseableShellError('tilde expansion is not allowed')
      }
    }

    if (char === '&') {
      if (command[index + 1] === '&') {
        endSegment(false)
        index += 2
        continue
      }
      throw new UnparseableShellError('background jobs and bare & are not allowed')
    }

    if (char === '|') {
      if (command[index + 1] === '|') {
        throw new UnparseableShellError('|| chaining is not allowed')
      }
      endSegment(true)
      index += 1
      continue
    }

    const forbidden = FORBIDDEN_BARE.get(char)
    if (forbidden !== undefined) {
      throw new UnparseableShellError(`${forbidden} are not allowed`)
    }

    word += char
    inWord = true
    index += 1
  }

  endSegment(false)
  return segments
}
