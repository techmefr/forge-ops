import { spawnSync } from 'node:child_process'

const MAX_BUFFER_BYTES = 32 * 1024 * 1024
const BASE_CANDIDATES = ['develop', 'main', 'master']

export interface IGitRun {
  ok: boolean
  stdout: string
  stderr: string
  status: number
}

export function runGit(cwd: string | null, args: string[]): IGitRun {
  const fullArgs = cwd !== null ? ['-C', cwd, ...args] : args
  const result = spawnSync('git', fullArgs, { encoding: 'utf-8', maxBuffer: MAX_BUFFER_BYTES })
  if (result.error !== undefined) {
    return { ok: false, stdout: '', stderr: result.error.message, status: -1 }
  }
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? -1,
  }
}

export interface IGitWorktree {
  path: string
  head: string | null
  branch: string | null
}

export function parseWorktreeList(porcelain: string): IGitWorktree[] {
  const worktrees: IGitWorktree[] = []
  let current: IGitWorktree | null = null
  for (const rawLine of porcelain.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length), head: null, branch: null }
      worktrees.push(current)
    } else if (current !== null && line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length)
    } else if (current !== null && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    }
  }
  return worktrees
}

function unquotePath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value
  }
  return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

export function parseStatusPaths(porcelain: string): string[] {
  const paths = new Set<string>()
  for (const rawLine of porcelain.split('\n')) {
    if (rawLine.length < 4) {
      continue
    }
    const payload = rawLine.slice(3)
    const arrow = payload.indexOf(' -> ')
    if (arrow === -1) {
      paths.add(unquotePath(payload))
    } else {
      paths.add(unquotePath(payload.slice(0, arrow)))
      paths.add(unquotePath(payload.slice(arrow + 4)))
    }
  }
  return [...paths].sort()
}

export interface IMergeTreeOutput {
  tree: string | null
  files: string[]
}

/**
 * `git merge-tree --write-tree --name-only` ecrit l'OID de l'arbre fusionne sur
 * la premiere ligne, puis une section de fichiers en conflit, puis des messages
 * informatifs, les sections separees par une ligne vide.
 */
export function parseMergeTree(stdout: string): IMergeTreeOutput {
  const lines = stdout.split('\n').map((line) => line.trim())
  const first = lines[0] ?? ''
  const tree = first === '' ? null : first
  const files: string[] = []
  let index = 1
  while (index < lines.length && lines[index] === '') {
    index += 1
  }
  while (index < lines.length && lines[index] !== '') {
    files.push(lines[index] as string)
    index += 1
  }
  return { tree, files: [...new Set(files)].sort() }
}

export function listGitWorktrees(repoPath: string): IGitWorktree[] {
  const result = runGit(repoPath, ['worktree', 'list', '--porcelain'])
  return result.ok ? parseWorktreeList(result.stdout) : []
}

export function resolveBase(repoPath: string, preferred: string | null = null): string | null {
  const candidates = preferred !== null ? [preferred, ...BASE_CANDIDATES] : BASE_CANDIDATES
  const head = runGit(repoPath, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
  if (head.ok && head.stdout.trim() !== '') {
    candidates.unshift(head.stdout.trim())
  }
  for (const candidate of candidates) {
    if (runGit(repoPath, ['rev-parse', '--verify', '--quiet', candidate]).ok) {
      return candidate
    }
  }
  return null
}

export function headSha(cwd: string): string | null {
  const result = runGit(cwd, ['rev-parse', 'HEAD'])
  return result.ok ? result.stdout.trim() : null
}

/**
 * Fichiers deja livres par la branche : diff a trois points contre la base, donc
 * ce que la branche a ajoute, sans ce que la base a bouge de son cote.
 */
export function committedFiles(cwd: string, base: string, head = 'HEAD'): string[] {
  const result = runGit(cwd, ['diff', '--name-only', `${base}...${head}`])
  if (!result.ok) {
    return []
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .sort()
}

export function dirtyFiles(cwd: string): string[] {
  const result = runGit(cwd, ['status', '--porcelain'])
  return result.ok ? parseStatusPaths(result.stdout) : []
}

/**
 * Commit de l'etat sale sans toucher au working tree ni a la pile de stash :
  * c'est ce qui permet de faire porter la detection de conflit sur du code pas
 * encore commite. Chaine vide quand la worktree est propre.
 */
export function dirtyCommit(cwd: string): string | null {
  const result = runGit(cwd, ['stash', 'create'])
  if (!result.ok) {
    return null
  }
  const sha = result.stdout.trim()
  return sha === '' ? null : sha
}

export interface IConflictCheck {
  ok: boolean
  conflicted: boolean
  files: string[]
  detail: string
}

export function checkMergeConflict(
  repoPath: string,
  left: string,
  right: string,
): IConflictCheck {
  const result = runGit(repoPath, ['merge-tree', '--write-tree', '--name-only', left, right])
  if (result.status === 0) {
    return { ok: true, conflicted: false, files: [], detail: 'fusion propre' }
  }
  if (result.status !== 1) {
    return {
      ok: false,
      conflicted: false,
      files: [],
      detail: `git merge-tree a echoue: ${result.stderr.trim()}`,
    }
  }
  const parsed = parseMergeTree(result.stdout)
  return {
    ok: true,
    conflicted: true,
    files: parsed.files,
    detail: `${parsed.files.length} fichier(s) en conflit`,
  }
}
