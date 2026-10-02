import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createStoryPublisher,
  forgeOf,
  PublicationFailedError,
  type CommandRunner,
} from '../../../src/technical/Git/StoryPublication.js'

let scratch: string
let origin: string
let checkout: string
let worktree: string
let calls: { file: string; argv: readonly string[] }[]

function git(cwd: string, ...argv: string[]): string {
  return execFileSync('git', argv, { cwd, encoding: 'utf-8' }).trim()
}

function runnerWith(forgeOutput: string, failing?: string, signedOut?: string): CommandRunner {
  return (file, argv, cwd) => {
    if (file === 'git') {
      return git(cwd, ...argv)
    }
    if (argv[0] === 'auth') {
      if (signedOut === file) {
        throw new Error(`${file} is not signed in`)
      }
      return ''
    }
    calls.push({ file, argv })
    if (failing === file) {
      throw new Error(`${file} exploded`)
    }
    return forgeOutput
  }
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    worktreePath: worktree,
    branch: 'story/forge-1-see-mails',
    baseBranch: 'main',
    title: 'See the mails',
    body: 'FORGE-1',
    autoMerge: false,
    ...overrides,
  }
}

beforeEach(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'forge-publication-')))
  origin = join(scratch, 'origin.git')
  checkout = join(scratch, 'checkout')
  worktree = join(scratch, 'worktree')
  calls = []
  mkdirSync(origin)
  git(origin, 'init', '--bare', '--initial-branch=main')
  mkdirSync(checkout)
  git(checkout, 'init', '--initial-branch=main')
  git(checkout, 'config', 'user.email', 'e2e@forge-ops.test')
  git(checkout, 'config', 'user.name', 'forge-ops e2e')
  writeFileSync(join(checkout, 'README.md'), 'demo\n')
  git(checkout, 'add', 'README.md')
  git(checkout, 'commit', '-m', 'initial')
  git(checkout, 'remote', 'add', 'origin', origin)
  git(checkout, 'push', 'origin', 'main')
  git(checkout, 'worktree', 'add', '-b', 'story/forge-1-see-mails', worktree, 'main')
  git(worktree, 'config', 'user.email', 'e2e@forge-ops.test')
  git(worktree, 'config', 'user.name', 'forge-ops e2e')
  writeFileSync(join(worktree, 'feature.txt'), 'feature\n')
  git(worktree, 'add', 'feature.txt')
  git(worktree, 'commit', '-m', 'feat: feature')
})

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('forgeOf', () => {
  it('recognises GitHub and GitLab remotes', () => {
    expect(forgeOf('git@github.com:techmefr/forge-ops.git')).toBe('github')
    expect(forgeOf('https://gitlab.example.com/team/app.git')).toBe('gitlab')
    expect(forgeOf('/srv/git/app.git')).toBe('unknown')
  })
})

describe('publishing a story branch', () => {
  it('pushes the story branch to the remote and sets its upstream', () => {
    createStoryPublisher(runnerWith('')).publish(order())

    expect(git(origin, 'branch', '--list', 'story/forge-1-see-mails')).toContain('story/forge-1-see-mails')
    expect(git(worktree, 'rev-parse', '--abbrev-ref', 'story/forge-1-see-mails@{upstream}')).toBe(
      'origin/story/forge-1-see-mails',
    )
  })

  it('opens a pull request on GitHub with the story branch and the base branch', () => {
    const report = createStoryPublisher(runnerWith('https://github.com/acme/app/pull/12')).publish(
      order({ remoteUrl: 'git@github.com:acme/app.git' }),
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.file).toBe('gh')
    expect(calls[0]?.argv).toEqual(
      expect.arrayContaining(['pr', 'create', '--head', 'story/forge-1-see-mails', '--base', 'main']),
    )
    expect(report).toMatchObject({ pushed: true, requestUrl: 'https://github.com/acme/app/pull/12', mergeRequested: false })
  })

  it('opens a merge request on GitLab', () => {
    const report = createStoryPublisher(runnerWith('Creating merge request\nhttps://gitlab.example.com/acme/app/-/merge_requests/3')).publish(
      order({ remoteUrl: 'https://gitlab.example.com/acme/app.git' }),
    )

    expect(calls[0]?.file).toBe('glab')
    expect(report.requestUrl).toBe('https://gitlab.example.com/acme/app/-/merge_requests/3')
  })

  it('never requests the merge unless the project asked for it', () => {
    createStoryPublisher(runnerWith('https://github.com/acme/app/pull/12')).publish(
      order({ remoteUrl: 'git@github.com:acme/app.git', autoMerge: false }),
    )

    expect(calls.some((call) => call.argv.includes('merge'))).toBe(false)
  })

  it('requests an automatic squash merge when the project asked for it', () => {
    const report = createStoryPublisher(runnerWith('https://github.com/acme/app/pull/12')).publish(
      order({ remoteUrl: 'git@github.com:acme/app.git', autoMerge: true }),
    )

    expect(calls[1]?.argv).toEqual(['pr', 'merge', 'https://github.com/acme/app/pull/12', '--squash', '--auto'])
    expect(report.mergeRequested).toBe(true)
  })

  it('pushes and says so when the remote is neither GitHub nor GitLab', () => {
    const report = createStoryPublisher(runnerWith('')).publish(order())

    expect(report).toMatchObject({ pushed: true, requestUrl: null })
    expect(report.note).toContain('by hand')
    expect(calls).toHaveLength(0)
  })

  it('publishes nothing and says why when the checkout has no origin', () => {
    git(checkout, 'remote', 'remove', 'origin')

    const report = createStoryPublisher(runnerWith('')).publish(order())

    expect(report).toMatchObject({ pushed: false, requestUrl: null })
    expect(report.note).toContain('no origin')
  })

  it('pushes and says to open the request by hand when the forge tool is signed out', () => {
    const report = createStoryPublisher(runnerWith('', undefined, 'gh')).publish(
      order({ remoteUrl: 'git@github.com:acme/app.git', autoMerge: true }),
    )

    expect(report).toMatchObject({ pushed: true, requestUrl: null, mergeRequested: false })
    expect(report.note).toContain('open the pull request by hand')
    expect(calls).toHaveLength(0)
    expect(git(origin, 'branch', '--list', 'story/forge-1-see-mails')).toContain('story/forge-1-see-mails')
  })

  it('does the same on GitLab when glab is signed out', () => {
    const report = createStoryPublisher(runnerWith('', undefined, 'glab')).publish(
      order({ remoteUrl: 'https://gitlab.example.com/acme/app.git' }),
    )

    expect(report).toMatchObject({ pushed: true, requestUrl: null })
    expect(report.note).toContain('open the merge request by hand')
  })

  it('fails visibly when the forge tool fails', () => {
    expect(() =>
      createStoryPublisher(runnerWith('', 'gh')).publish(order({ remoteUrl: 'git@github.com:acme/app.git' })),
    ).toThrow(PublicationFailedError)
  })

  it('fails visibly when the push is refused', () => {
    expect(() => createStoryPublisher(runnerWith('')).publish(order({ branch: 'story/unknown-branch' }))).toThrow(
      PublicationFailedError,
    )
  })
})
