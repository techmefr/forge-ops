import { execFileSync } from 'node:child_process'

export class PublicationFailedError extends Error {
  constructor(step: string, reason: string) {
    super(`Publishing the story failed at ${step}: ${reason}`)
    this.name = 'PublicationFailedError'
  }
}

export type CommandRunner = (file: string, argv: readonly string[], cwd: string) => string

export type PublicationOrder = {
  worktreePath: string
  branch: string
  baseBranch: string
  title: string
  body: string
  autoMerge: boolean
  remoteUrl?: string
}

export type PublicationReport = {
  branch: string
  pushed: boolean
  requestUrl: string | null
  mergeRequested: boolean
  note: string | null
}

export type StoryPublisher = {
  publish: (order: PublicationOrder) => PublicationReport
}

type Forge = 'github' | 'gitlab' | 'unknown'

const URL_PATTERN = /https?:\/\/\S+/g

function runCommand(file: string, argv: readonly string[], cwd: string): string {
  return execFileSync(file, [...argv], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function reasonOf(error: unknown): string {
  const stderr = (error as { stderr?: Buffer | string }).stderr
  const text = typeof stderr === 'string' ? stderr : stderr instanceof Buffer ? stderr.toString('utf-8') : ''
  if (text.trim() !== '') {
    return text.trim()
  }
  return error instanceof Error ? error.message : String(error)
}

export function forgeOf(remoteUrl: string): Forge {
  const lowered = remoteUrl.toLowerCase()
  if (lowered.includes('github')) {
    return 'github'
  }
  return lowered.includes('gitlab') ? 'gitlab' : 'unknown'
}

function lastUrlOf(output: string): string | null {
  const found = output.match(URL_PATTERN)
  return found === null ? null : (found[found.length - 1] ?? null)
}

export function createStoryPublisher(run: CommandRunner = runCommand): StoryPublisher {
  function attempt(step: string, file: string, argv: readonly string[], cwd: string): string {
    try {
      return run(file, argv, cwd)
    } catch (error) {
      throw new PublicationFailedError(step, reasonOf(error))
    }
  }

  function unavailableNote(forge: 'github' | 'gitlab', cwd: string): string | null {
    const cli = forge === 'github' ? 'gh' : 'glab'
    try {
      run(cli, ['auth', 'status'], cwd)
      return null
    } catch {
      const noun = forge === 'github' ? 'pull' : 'merge'
      return `${cli} is missing or not signed in, the branch is pushed: open the ${noun} request by hand`
    }
  }

  return {
    publish: (order) => {
      let remoteUrl: string
      try {
        remoteUrl = order.remoteUrl ?? run('git', ['remote', 'get-url', 'origin'], order.worktreePath)
      } catch {
        return {
          branch: order.branch,
          pushed: false,
          requestUrl: null,
          mergeRequested: false,
          note: 'The checkout has no origin remote, nothing was published',
        }
      }
      attempt('pushing the branch', 'git', ['push', '--set-upstream', 'origin', order.branch], order.worktreePath)
      const forge = forgeOf(remoteUrl)
      if (forge === 'unknown') {
        return {
          branch: order.branch,
          pushed: true,
          requestUrl: null,
          mergeRequested: false,
          note: 'The remote is neither GitHub nor GitLab, open the merge request by hand',
        }
      }
      const unavailable = unavailableNote(forge, order.worktreePath)
      if (unavailable !== null) {
        return { branch: order.branch, pushed: true, requestUrl: null, mergeRequested: false, note: unavailable }
      }
      if (forge === 'github') {
        const created = attempt(
          'opening the pull request',
          'gh',
          ['pr', 'create', '--head', order.branch, '--base', order.baseBranch, '--title', order.title, '--body', order.body],
          order.worktreePath,
        )
        const requestUrl = lastUrlOf(created)
        if (order.autoMerge && requestUrl !== null) {
          attempt('requesting the merge', 'gh', ['pr', 'merge', requestUrl, '--squash', '--auto'], order.worktreePath)
        }
        return {
          branch: order.branch,
          pushed: true,
          requestUrl,
          mergeRequested: order.autoMerge && requestUrl !== null,
          note: null,
        }
      }
      const created = attempt(
        'opening the merge request',
        'glab',
        [
          'mr',
          'create',
          '--source-branch',
          order.branch,
          '--target-branch',
          order.baseBranch,
          '--title',
          order.title,
          '--description',
          order.body,
          '--yes',
        ],
        order.worktreePath,
      )
      const requestUrl = lastUrlOf(created)
      if (order.autoMerge && requestUrl !== null) {
        attempt(
          'requesting the merge',
          'glab',
          ['mr', 'merge', requestUrl, '--squash', '--when-pipeline-succeeds', '--yes'],
          order.worktreePath,
        )
      }
      return {
        branch: order.branch,
        pushed: true,
        requestUrl,
        mergeRequested: order.autoMerge && requestUrl !== null,
        note: null,
      }
    },
  }
}
