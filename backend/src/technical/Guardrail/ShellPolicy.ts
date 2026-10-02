import { existsSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { holdsProtectedPath, isProtectedPath, protectedRepresentativesOf, realPathOf, relativeToRoot } from './ProtectedPaths.js'
import { tokenizeShell, UnparseableShellError, type ShellSegment } from './ShellTokens.js'

export type ShellContext = {
  phase: string
  root: string
  storyBranch: string | null
  pushRemote: string
  testCommands: readonly string[]
}

export type ShellDecision = { allowed: true } | { allowed: false; reason: string }

type PhaseClass = 'build' | 'verify' | 'ship'

type Walk = {
  context: ShellContext
  klass: PhaseClass
  cwd: string
}

type Problem = string | null

type PathMode = 'read' | 'write' | 'remove'

const PHASE_CLASS: Readonly<Record<string, PhaseClass>> = {
  tdd: 'build',
  code: 'build',
  gate: 'verify',
  review: 'verify',
  ship: 'ship',
}

const SAFE_ENV_NAMES = new Set(['CI', 'NODE_ENV', 'FORCE_COLOR', 'NO_COLOR', 'TZ', 'LANG'])
const SAFE_ENV_VALUE = /^[A-Za-z0-9._:-]*$/
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const BARE_COMMAND = /^[a-z][a-z0-9_.+-]*$/
const GLOB = /[*?[]/
const SAFE_REF = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/
const SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9:_.-]*$/
const PACKAGE_SPEC = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[A-Za-z0-9._^~-]+)?$/

const READ_COMMANDS = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'rg',
  'find',
  'sort',
  'uniq',
  'cut',
  'tr',
  'nl',
  'diff',
  'stat',
  'file',
  'pwd',
  'echo',
  'printf',
  'true',
  'false',
  'date',
  'basename',
  'dirname',
  'realpath',
  'du',
  'cd',
])

const FILTER_COMMANDS = new Set(['grep', 'rg', 'head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'tr', 'nl', 'cat'])

const WRITE_COMMANDS = new Set(['mkdir', 'touch', 'cp', 'mv', 'rm', 'rmdir'])

const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn'])

const NPX_TOOLS = new Set(['vitest', 'tsc', 'eslint', 'prettier', 'jest', 'vue-tsc', 'playwright', 'stylelint'])

const READ_GIT = new Set([
  'status',
  'diff',
  'log',
  'show',
  'rev-parse',
  'ls-files',
  'ls-tree',
  'blame',
  'merge-base',
  'rev-list',
  'describe',
  'shortlog',
  'grep',
  'cat-file',
])

const BUILD_GIT = new Set(['add', 'commit', 'restore', 'rm'])

const DANGEROUS_READ_FLAGS = [
  '--output',
  '-O',
  '--open-files-in-pager',
  '--ext-diff',
  '--git-dir',
  '--work-tree',
  '--exec-path',
  '--upload-pack',
  '--receive-pack',
  '--config-env',
  '--namespace',
  '--super-prefix',
]

const FIND_EXECUTION_FLAGS = new Set([
  '-exec',
  '-execdir',
  '-ok',
  '-okdir',
  '-delete',
  '-fprint',
  '-fprint0',
  '-fprintf',
  '-fls',
])

const BRANCH_LIST_FLAGS = new Set([
  '-a',
  '-r',
  '-v',
  '-vv',
  '-l',
  '--all',
  '--remotes',
  '--verbose',
  '--list',
  '--show-current',
])

const ADD_FLAGS = new Set([
  '-A',
  '-u',
  '-N',
  '-v',
  '-n',
  '--all',
  '--update',
  '--intent-to-add',
  '--verbose',
  '--dry-run',
  '--ignore-errors',
  '--renormalize',
])

const COMMIT_LONG_FLAGS = new Set([
  '--all',
  '--signoff',
  '--amend',
  '--no-edit',
  '--allow-empty',
  '--allow-empty-message',
  '--quiet',
])

const COMMIT_SHORT_LETTERS = new Set(['a', 's', 'q'])

const PM_FLAGS = new Set([
  '--silent',
  '-s',
  '--if-present',
  '--frozen-lockfile',
  '--ignore-scripts',
  '--prefer-offline',
  '--no-audit',
  '--no-fund',
])

const RESTORE_FLAGS = new Set(['--staged', '-S', '--worktree', '-W', '--quiet', '-q'])

const NODE_TEST_FLAGS = [
  '--test',
  '--test-reporter',
  '--test-name-pattern',
  '--test-only',
  '--experimental-test-coverage',
]

function denied(reason: string): ShellDecision {
  return { allowed: false, reason: `Shell policy: ${reason}` }
}

function globSegmentMatches(pattern: string, segment: string): boolean {
  if (segment.startsWith('.') && !pattern.startsWith('.')) {
    return false
  }
  let source = ''
  let index = 0
  while (index < pattern.length) {
    const char = pattern[index] as string
    if (char === '*') {
      source += '[^/]*'
    } else if (char === '?') {
      source += '[^/]'
    } else if (char === '[') {
      const close = pattern.indexOf(']', index + 2)
      if (close === -1) {
        source += '\\['
      } else {
        const body = pattern.slice(index + 1, close).replace(/^!/, '^').replace(/\\/g, '\\\\')
        source += `[${body}]`
        index = close
      }
    } else {
      source += char.replace(/[.+^${}()|\\/]/g, '\\$&')
    }
    index += 1
  }
  try {
    return new RegExp(`^${source}$`, 'i').test(segment)
  } catch {
    return true
  }
}

function globMayHitProtected(walk: Walk, token: string, mode: PathMode): boolean {
  const rel = relativeToRoot(walk.context.root, resolve(walk.cwd, token))
  if (rel === null) {
    return true
  }
  const patternSegments = rel.split('/').filter((segment) => segment !== '')
  const folderRepresentatives = new Set(['.claude/hooks', '.git', 'backend/src/technical/Guardrail'])
  const root = walk.context.root
  const present = protectedRepresentativesOf(root).filter((absolute) => existsSync(absolute))
  return present.some((absolute) => {
    const representative = relative(root, absolute).split(sep).join('/')
    const parts = representative.split('/')
    const shared = Math.min(patternSegments.length, parts.length)
    for (let position = 0; position < shared; position += 1) {
      if (!globSegmentMatches(patternSegments[position] as string, parts[position] as string)) {
        return false
      }
    }
    if (patternSegments.length === parts.length) {
      return true
    }
    if (patternSegments.length > parts.length) {
      return folderRepresentatives.has(representative)
    }
    return mode === 'remove'
  })
}

function pathProblem(walk: Walk, token: string, mode: PathMode): Problem {
  if (token.startsWith('~')) {
    return `${token} uses tilde expansion`
  }
  const absolute = resolve(walk.cwd, token)
  const withinRoot = relativeToRoot(walk.context.root, absolute)
  if (withinRoot === null) {
    return `${token} is outside the story worktree`
  }
  if (mode === 'read') {
    return null
  }
  if (withinRoot === '') {
    return `${token} is the worktree itself`
  }
  if (GLOB.test(token)) {
    return globMayHitProtected(walk, token, mode) ? `${token} may reach a protected guardrail path` : null
  }
  if (isProtectedPath(walk.context.root, absolute)) {
    return `${token} is a protected guardrail path (settings, hooks, deny list, .git)`
  }
  if (mode === 'remove' && holdsProtectedPath(walk.context.root, absolute)) {
    return `${token} contains protected guardrail paths`
  }
  return null
}

function flagValueProblem(walk: Walk, flag: string): Problem {
  const equals = flag.indexOf('=')
  const value = equals === -1 ? (flag.startsWith('--') ? '' : flag.slice(2)) : flag.slice(equals + 1)
  if (value.includes('/') || value.split('/').includes('..')) {
    return pathProblem(walk, value, 'read')
  }
  return null
}

function readArgsProblem(walk: Walk, args: readonly string[]): Problem {
  let afterSeparator = false
  for (const arg of args) {
    if (!afterSeparator && arg === '--') {
      afterSeparator = true
      continue
    }
    const problem =
      !afterSeparator && arg.startsWith('-') && arg.length > 1
        ? flagValueProblem(walk, arg)
        : pathProblem(walk, arg, 'read')
    if (problem !== null) {
      return problem
    }
  }
  return null
}

type FlagSplit = { positionals: string[]; problem: Problem }

function splitFlags(
  args: readonly string[],
  allowed: { short: string; long: readonly string[] },
): FlagSplit {
  const positionals: string[] = []
  let afterSeparator = false
  for (const arg of args) {
    if (afterSeparator || arg === '-' || !arg.startsWith('-')) {
      positionals.push(arg)
      continue
    }
    if (arg === '--') {
      afterSeparator = true
      continue
    }
    if (arg.startsWith('--')) {
      if (!allowed.long.includes(arg)) {
        return { positionals, problem: `the flag ${arg} is not allowed here` }
      }
      continue
    }
    for (const letter of arg.slice(1)) {
      if (!allowed.short.includes(letter)) {
        return { positionals, problem: `the flag -${letter} is not allowed here` }
      }
    }
  }
  return { positionals, problem: null }
}

function checkPositionals(walk: Walk, positionals: readonly string[], mode: PathMode): Problem {
  for (const positional of positionals) {
    const problem = pathProblem(walk, positional, mode)
    if (problem !== null) {
      return problem
    }
  }
  return null
}

function checkWriteUtility(walk: Walk, name: string, args: readonly string[]): Problem {
  const flags: Record<string, { short: string; long: string[] }> = {
    mkdir: { short: 'pv', long: ['--parents', '--verbose'] },
    touch: { short: 'c', long: ['--no-create'] },
    cp: { short: 'rRvnpf', long: ['--recursive', '--verbose', '--no-clobber'] },
    mv: { short: 'vnf', long: ['--verbose', '--no-clobber'] },
    rm: { short: 'rRfvid', long: ['--recursive', '--force', '--verbose'] },
    rmdir: { short: 'pv', long: ['--parents', '--verbose'] },
  }
  const split = splitFlags(args, flags[name] as { short: string; long: string[] })
  if (split.problem !== null) {
    return `${name}: ${split.problem}`
  }
  if (split.positionals.length === 0) {
    return `${name} needs at least one path`
  }
  if (name === 'cp') {
    if (split.positionals.length < 2) {
      return 'cp needs a source and a destination'
    }
    const target = split.positionals[split.positionals.length - 1] as string
    const sources = split.positionals.slice(0, -1)
    return checkPositionals(walk, sources, 'read') ?? pathProblem(walk, target, 'write')
  }
  if (name === 'mv') {
    if (split.positionals.length < 2) {
      return 'mv needs a source and a destination'
    }
    const target = split.positionals[split.positionals.length - 1] as string
    const sources = split.positionals.slice(0, -1)
    return checkPositionals(walk, sources, 'remove') ?? pathProblem(walk, target, 'write')
  }
  const mode: PathMode = name === 'rm' || name === 'rmdir' ? 'remove' : 'write'
  return checkPositionals(walk, split.positionals, mode)
}

function withoutPattern(args: readonly string[]): string[] {
  const patternFlag = args.findIndex((arg) => arg === '-e' || arg === '--regexp')
  if (patternFlag !== -1) {
    return args.filter((_, position) => position !== patternFlag + 1)
  }
  const firstPositional = args.findIndex((arg) => !arg.startsWith('-'))
  return args.filter((_, position) => position !== firstPositional)
}

function checkReadUtility(walk: Walk, name: string, args: readonly string[]): Problem {
  if (name === 'find') {
    const hit = args.find((arg) => FIND_EXECUTION_FLAGS.has(arg))
    if (hit !== undefined) {
      return `find ${hit} can run or write things`
    }
  }
  if (name === 'rg') {
    const hit = args.find(
      (arg) =>
        arg.startsWith('--pre') ||
        arg.startsWith('--hostname-bin') ||
        arg === '-z' ||
        arg === '--search-zip',
    )
    if (hit !== undefined) {
      return `rg ${hit} can run external programs`
    }
  }
  if (name === 'sort') {
    const hit = args.find(
      (arg) =>
        arg === '-o' ||
        (arg.startsWith('-') && !arg.startsWith('--') && arg.slice(1).includes('o')) ||
        arg.startsWith('--output') ||
        arg.startsWith('--compress-program'),
    )
    if (hit !== undefined) {
      return `sort ${hit} can write a file or run a program`
    }
  }
  if (name === 'date') {
    const hit = args.find((arg) => arg === '-s' || arg.startsWith('--set'))
    if (hit !== undefined) {
      return 'date cannot set the clock'
    }
  }
  if (name === 'uniq' && args.filter((arg) => !arg.startsWith('-')).length > 1) {
    return 'uniq with an output file can write'
  }
  if (name === 'echo' || name === 'printf' || name === 'true' || name === 'false' || name === 'pwd') {
    return null
  }
  if (name === 'grep' || name === 'rg') {
    return readArgsProblem(walk, withoutPattern(args))
  }
  return readArgsProblem(walk, args)
}

function checkCd(walk: Walk, args: readonly string[]): Problem {
  if (args.length !== 1 || (args[0] as string).startsWith('-')) {
    return 'cd takes exactly one path inside the worktree'
  }
  const problem = pathProblem(walk, args[0] as string, 'read')
  if (problem !== null) {
    return problem
  }
  walk.cwd = resolve(walk.cwd, args[0] as string)
  return null
}

function dangerousReadFlag(args: readonly string[]): string | null {
  for (const arg of args) {
    if (arg === '--') {
      return null
    }
    const hit = DANGEROUS_READ_FLAGS.find((flag) => arg === flag || arg.startsWith(`${flag}=`) || (flag === '-O' && arg.startsWith('-O')))
    if (hit !== undefined) {
      return hit
    }
  }
  return null
}

function checkBranch(args: readonly string[]): Problem {
  const bad = args.find((arg) => !BRANCH_LIST_FLAGS.has(arg))
  return bad === undefined ? null : `git branch only lists branches here, ${bad} is refused`
}

function checkAdd(walk: Walk, args: readonly string[]): Problem {
  let afterSeparator = false
  for (const arg of args) {
    if (!afterSeparator && arg === '--') {
      afterSeparator = true
      continue
    }
    if (!afterSeparator && arg.startsWith('-')) {
      if (!ADD_FLAGS.has(arg)) {
        return `git add ${arg} is not allowed`
      }
      continue
    }
    const problem = pathProblem(walk, arg, 'read')
    if (problem !== null) {
      return problem
    }
  }
  return null
}

function checkCommit(walk: Walk, args: readonly string[]): Problem {
  let index = 0
  while (index < args.length) {
    const arg = args[index] as string
    if (arg === '--') {
      return checkPositionals(walk, args.slice(index + 1), 'read')
    }
    if (arg === '--message' || arg === '--file') {
      if (args[index + 1] === undefined) {
        return `git commit ${arg} needs a value`
      }
      const problem = arg === '--file' ? pathProblem(walk, args[index + 1] as string, 'read') : null
      if (problem !== null) {
        return problem
      }
      index += 2
      continue
    }
    if (arg.startsWith('--')) {
      if (!COMMIT_LONG_FLAGS.has(arg)) {
        return `git commit ${arg} is not allowed`
      }
      index += 1
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      const letters = [...arg.slice(1)]
      for (const [position, letter] of letters.entries()) {
        if (letter === 'm' || letter === 'F') {
          if (position !== letters.length - 1) {
            return `git commit ${arg}: the message flag must come last in a cluster`
          }
          const value = args[index + 1]
          if (value === undefined) {
            return `git commit -${letter} needs a value`
          }
          const problem = letter === 'F' ? pathProblem(walk, value, 'read') : null
          if (problem !== null) {
            return problem
          }
          index += 1
        } else if (!COMMIT_SHORT_LETTERS.has(letter)) {
          return `git commit -${letter} is not allowed`
        }
      }
      index += 1
      continue
    }
    const problem = pathProblem(walk, arg, 'read')
    if (problem !== null) {
      return problem
    }
    index += 1
  }
  return null
}

function checkRestore(walk: Walk, args: readonly string[]): Problem {
  const paths: string[] = []
  let index = 0
  let afterSeparator = false
  while (index < args.length) {
    const arg = args[index] as string
    if (!afterSeparator && arg === '--') {
      afterSeparator = true
    } else if (!afterSeparator && (arg === '--source' || arg === '-s')) {
      const value = args[index + 1]
      if (value === undefined || !SAFE_REF.test(value)) {
        return 'git restore --source needs a plain revision'
      }
      index += 1
    } else if (!afterSeparator && arg.startsWith('--source=')) {
      if (!SAFE_REF.test(arg.slice('--source='.length))) {
        return 'git restore --source needs a plain revision'
      }
    } else if (!afterSeparator && arg.startsWith('-') && !RESTORE_FLAGS.has(arg)) {
      return `git restore ${arg} is not allowed`
    } else if (afterSeparator || !arg.startsWith('-')) {
      paths.push(arg)
    }
    index += 1
  }
  if (paths.length === 0) {
    return 'git restore needs explicit paths'
  }
  return checkPositionals(walk, paths, 'write')
}

function checkGitRm(walk: Walk, args: readonly string[]): Problem {
  const split = splitFlags(args, { short: 'rqn', long: ['--cached', '--quiet', '--ignore-unmatch', '--dry-run'] })
  if (split.problem !== null) {
    return `git rm: ${split.problem}`
  }
  if (split.positionals.length === 0) {
    return 'git rm needs explicit paths'
  }
  return checkPositionals(walk, split.positionals, 'remove')
}

function checkFetch(walk: Walk, args: readonly string[]): Problem {
  const split = splitFlags(args, { short: 'qp', long: ['--quiet', '--prune'] })
  if (split.problem !== null) {
    return `git fetch: ${split.problem}`
  }
  const [remote, ref, extra] = split.positionals
  if (extra !== undefined) {
    return 'git fetch takes at most a remote and one ref'
  }
  if (remote !== undefined && remote !== walk.context.pushRemote) {
    return `git fetch may only talk to the remote ${walk.context.pushRemote}`
  }
  if (ref !== undefined && !SAFE_REF.test(ref)) {
    return 'git fetch refspecs with + or : are refused'
  }
  return null
}

function checkRebase(args: readonly string[]): Problem {
  if (args.length === 1 && ['--continue', '--abort', '--skip'].includes(args[0] as string)) {
    return null
  }
  if (args.length === 1 && SAFE_REF.test(args[0] as string)) {
    return null
  }
  return 'git rebase takes one plain revision (no --exec, no interactive mode)'
}

function checkPush(walk: Walk, args: readonly string[]): Problem {
  const { storyBranch, pushRemote } = walk.context
  if (storyBranch === null) {
    return 'git push is refused: the story has no branch'
  }
  if (args.length !== 2 || args[0] !== pushRemote || args[1] !== storyBranch) {
    return `git push is only allowed as: git push ${pushRemote} ${storyBranch}`
  }
  return null
}

function checkGit(walk: Walk, args: readonly string[]): Problem {
  const subcommand = args[0]
  if (subcommand === undefined || subcommand.startsWith('-')) {
    return 'git options before the subcommand (-C, -c, --git-dir) are refused'
  }
  const rest = args.slice(1)
  if (READ_GIT.has(subcommand)) {
    const flag = dangerousReadFlag(rest)
    return flag !== null ? `git ${subcommand} ${flag} is refused` : readArgsProblem(walk, rest)
  }
  if (subcommand === 'branch') {
    return checkBranch(rest)
  }
  if (walk.klass === 'build' && BUILD_GIT.has(subcommand)) {
    if (subcommand === 'add') return checkAdd(walk, rest)
    if (subcommand === 'commit') return checkCommit(walk, rest)
    if (subcommand === 'restore') return checkRestore(walk, rest)
    return checkGitRm(walk, rest)
  }
  if (walk.klass === 'ship') {
    if (subcommand === 'fetch') return checkFetch(walk, rest)
    if (subcommand === 'rebase') return checkRebase(rest)
    if (subcommand === 'push') return checkPush(walk, rest)
  }
  return `git ${subcommand} is not available in the ${walk.context.phase} phase`
}

function checkPackageManager(walk: Walk, manager: string, args: readonly string[]): Problem {
  const sub = args[0]
  if (sub === undefined) {
    return `${manager} needs a subcommand`
  }
  const testing = ['test', 't', 'tst'].includes(sub)
  const running = sub === 'run' || sub === 'run-script'
  const installing = ['ci', 'install', 'i', 'add'].includes(sub)
  const executing = sub === 'exec'
  const klass = walk.klass
  const permitted =
    testing ||
    (running && (klass === 'build' || klass === 'ship' || walk.context.phase === 'gate')) ||
    (executing && manager !== 'npm' && (klass === 'build' || klass === 'ship' || walk.context.phase === 'gate')) ||
    (installing && klass === 'build')
  if (!permitted) {
    return `${manager} ${sub} is not available in the ${walk.context.phase} phase`
  }
  const rest = args.slice(1)
  const separator = rest.indexOf('--')
  const own = separator === -1 ? rest : rest.slice(0, separator)
  const forwarded = separator === -1 ? [] : rest.slice(separator + 1)
  const positionals: string[] = []
  for (const token of own) {
    if (token.startsWith('-')) {
      if (!PM_FLAGS.has(token)) {
        return `${manager} ${token} is not allowed (only ${[...PM_FLAGS].join(', ')})`
      }
    } else {
      positionals.push(token)
    }
  }
  if (running && (positionals[0] === undefined || !SCRIPT_NAME.test(positionals[0]))) {
    return `${manager} run needs a plain script name`
  }
  if (executing) {
    if (positionals[0] === undefined || !NPX_TOOLS.has(positionals[0])) {
      return `${manager} exec only runs ${[...NPX_TOOLS].join(', ')}`
    }
  }
  if (installing && positionals.some((spec) => !PACKAGE_SPEC.test(spec))) {
    return `${manager} ${sub} only accepts registry package names`
  }
  const tail = running || executing ? positionals.slice(1) : testing ? positionals : []
  return readArgsProblem(walk, [...tail, ...forwarded])
}

function checkNpx(walk: Walk, args: readonly string[]): Problem {
  if (walk.klass === 'verify' && walk.context.phase !== 'gate') {
    return 'npx is not available in the review phase'
  }
  let index = 0
  while (args[index] === '--no-install' || args[index] === '--no' || args[index] === '--yes') {
    if (args[index] === '--yes') {
      return 'npx --yes may download and run arbitrary packages'
    }
    index += 1
  }
  const tool = args[index]
  if (tool === undefined || !NPX_TOOLS.has(tool)) {
    return `npx only runs ${[...NPX_TOOLS].join(', ')}`
  }
  return readArgsProblem(walk, args.slice(index + 1))
}

function checkNode(walk: Walk, args: readonly string[]): Problem {
  if (args[0] !== '--test') {
    return 'node is only allowed as: node --test'
  }
  for (const arg of args.slice(1)) {
    if (arg.startsWith('-')) {
      const name = arg.split('=')[0] as string
      if (!NODE_TEST_FLAGS.includes(name)) {
        return `node ${arg} is not allowed`
      }
    }
  }
  return readArgsProblem(walk, args.slice(1).filter((arg) => !arg.startsWith('-')))
}

function declaredWords(command: string): string[][] {
  try {
    return tokenizeShell(command).map((segment) => segment.words)
  } catch {
    return []
  }
}

function matchesDeclared(walk: Walk, words: readonly string[]): boolean {
  return walk.context.testCommands.some((declared) =>
    declaredWords(declared).some(
      (declaredSegment) =>
        declaredSegment.length > 0 && declaredSegment.every((word, position) => words[position] === word),
    ),
  )
}

function commandAllowed(walk: Walk, name: string): boolean {
  if (READ_COMMANDS.has(name) || name === 'git') {
    return true
  }
  if (walk.klass === 'build' && WRITE_COMMANDS.has(name)) {
    return true
  }
  return PACKAGE_MANAGERS.has(name) || name === 'npx' || name === 'node'
}

function checkSegment(walk: Walk, segment: ShellSegment): Problem {
  const words = [...segment.words]
  while (words[0] !== undefined && ASSIGNMENT.test(words[0])) {
    const equals = words[0].indexOf('=')
    const name = words[0].slice(0, equals)
    const value = words[0].slice(equals + 1)
    if (!SAFE_ENV_NAMES.has(name) || !SAFE_ENV_VALUE.test(value)) {
      return `the environment assignment ${name}= is not allowed`
    }
    words.shift()
  }
  const name = words[0]
  if (name === undefined) {
    return 'a bare environment assignment does nothing'
  }
  if (!BARE_COMMAND.test(name)) {
    return `${name} is not a bare command name (paths, wrappers and expansions are refused)`
  }
  const args = words.slice(1)
  if (segment.pipedFromPrevious && !FILTER_COMMANDS.has(name)) {
    return `${name} cannot receive piped output, only ${[...FILTER_COMMANDS].join(', ')} can`
  }
  if (matchesDeclared(walk, words)) {
    return readArgsProblem(walk, args)
  }
  if (!commandAllowed(walk, name)) {
    return `${name} is not on the allow-list of the ${walk.context.phase} phase`
  }
  if (name === 'cd') return checkCd(walk, args)
  if (name === 'git') return checkGit(walk, args)
  if (name === 'node') return checkNode(walk, args)
  if (name === 'npx') return checkNpx(walk, args)
  if (PACKAGE_MANAGERS.has(name)) return checkPackageManager(walk, name, args)
  if (WRITE_COMMANDS.has(name)) return checkWriteUtility(walk, name, args)
  return checkReadUtility(walk, name, args)
}

export function decideShellCommand(command: string, context: ShellContext): ShellDecision {
  const klass = PHASE_CLASS[context.phase]
  if (klass === undefined) {
    return denied(`the ${context.phase} phase has no shell access`)
  }
  let segments: ShellSegment[]
  try {
    segments = tokenizeShell(command)
  } catch (error) {
    if (error instanceof UnparseableShellError) {
      return denied(`command refused, ${error.message}. Use one plain command per call, or chain with && only`)
    }
    throw error
  }
  const root = realPathOf(context.root)
  const walk: Walk = { context: { ...context, root }, klass, cwd: root }
  for (const segment of segments) {
    const problem = checkSegment(walk, segment)
    if (problem !== null) {
      return denied(problem)
    }
  }
  return { allowed: true }
}

export type ShellSeed = {
  branch: string | null
  remote: string
  testCommands: readonly string[]
}

export const DEFAULT_PUSH_REMOTE = 'origin'

export const EMPTY_SHELL_SEED: ShellSeed = { branch: null, remote: DEFAULT_PUSH_REMOTE, testCommands: [] }

export function shellEnvOf(seed: ShellSeed): Record<string, string> {
  return {
    FORGE_PUSH_REMOTE: seed.remote,
    FORGE_TEST_COMMANDS: JSON.stringify(seed.testCommands),
    ...(seed.branch === null ? {} : { FORGE_STORY_BRANCH: seed.branch }),
  }
}

export function shellSeedOf(source: NodeJS.ProcessEnv): ShellSeed {
  let testCommands: string[] = []
  try {
    const parsed: unknown = JSON.parse(source.FORGE_TEST_COMMANDS ?? '[]')
    if (Array.isArray(parsed)) {
      testCommands = parsed.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    testCommands = []
  }
  const branch = source.FORGE_STORY_BRANCH
  return {
    branch: branch === undefined || branch.trim() === '' ? null : branch,
    remote: source.FORGE_PUSH_REMOTE?.trim() || DEFAULT_PUSH_REMOTE,
    testCommands,
  }
}

export function shellContextOf(phase: string, root: string, seed: ShellSeed): ShellContext {
  return { phase, root, storyBranch: seed.branch, pushRemote: seed.remote, testCommands: seed.testCommands }
}
