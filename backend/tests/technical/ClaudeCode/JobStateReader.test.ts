import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJobStates, readRoster } from '../../../src/technical/ClaudeCode/JobStateReader.js'

let claudeHome: string

function writeJob(id: string, content: string): void {
  const jobDir = join(claudeHome, 'jobs', id)
  mkdirSync(jobDir, { recursive: true })
  writeFileSync(join(jobDir, 'state.json'), content, 'utf-8')
}

beforeEach(() => {
  claudeHome = mkdtempSync(join(tmpdir(), 'forge-claude-home-'))
})

afterEach(() => {
  rmSync(claudeHome, { recursive: true, force: true })
})

describe('readJobStates', () => {
  it('reads a job and keeps the fields the board needs', () => {
    writeJob(
      'c3905d1d',
      JSON.stringify({
        state: 'done',
        cwd: '/home/gaetan/starfleet',
        sessionId: '9fe24018-1111-2222-3333-444455556666',
        name: 'flaky-test-fix',
        intent: 'investiguer le test instable',
        tokens: 90343,
        cliVersion: '2.1.196',
        updatedAt: '2026-06-30T14:54:26.726Z',
        template: 'bg',
      }),
    )

    const jobs = readJobStates(claudeHome)

    expect(jobs).toEqual([
      {
        id: 'c3905d1d',
        state: 'done',
        cwd: '/home/gaetan/starfleet',
        sessionId: '9fe24018-1111-2222-3333-444455556666',
        name: 'flaky-test-fix',
        intent: 'investiguer le test instable',
        tokens: 90343,
        cliVersion: '2.1.196',
        updatedAt: '2026-06-30T14:54:26.726Z',
      },
    ])
  })

  it('normalises the fields a real job leaves null', () => {
    writeJob(
      '38aa3b8b',
      JSON.stringify({
        state: 'failed',
        cwd: '/home/gaetan/starfleet',
        sessionId: 'aaaa',
        tokens: null,
        cliVersion: null,
      }),
    )

    const jobs = readJobStates(claudeHome)

    expect(jobs[0]?.tokens).toBeNull()
    expect(jobs[0]?.cliVersion).toBeNull()
    expect(jobs[0]?.name).toBeNull()
    expect(jobs[0]?.intent).toBeNull()
  })

  it('sorts the jobs by identifier', () => {
    writeJob('ae02929c', JSON.stringify({ state: 'failed' }))
    writeJob('38aa3b8b', JSON.stringify({ state: 'done' }))

    expect(readJobStates(claudeHome).map((job) => job.id)).toEqual(['38aa3b8b', 'ae02929c'])
  })

  it('skips a job directory without a state file', () => {
    mkdirSync(join(claudeHome, 'jobs', 'orphan'), { recursive: true })
    writeJob('38aa3b8b', JSON.stringify({ state: 'done' }))

    expect(readJobStates(claudeHome).map((job) => job.id)).toEqual(['38aa3b8b'])
  })

  it('skips a malformed state file instead of failing', () => {
    writeJob('broken', '{ not json')
    writeJob('38aa3b8b', JSON.stringify({ state: 'done' }))

    expect(readJobStates(claudeHome).map((job) => job.id)).toEqual(['38aa3b8b'])
  })

  it('skips a state file with no state field', () => {
    writeJob('stateless', JSON.stringify({ cwd: '/home/gaetan/starfleet' }))

    expect(readJobStates(claudeHome)).toEqual([])
  })

  it('ignores the files sitting next to the job directories', () => {
    mkdirSync(join(claudeHome, 'jobs'), { recursive: true })
    writeFileSync(join(claudeHome, 'jobs', 'pins.json'), '{}', 'utf-8')

    expect(readJobStates(claudeHome)).toEqual([])
  })

  it('returns nothing when the jobs directory does not exist', () => {
    expect(readJobStates(claudeHome)).toEqual([])
  })
})

describe('readRoster', () => {
  function writeRoster(content: string): void {
    mkdirSync(join(claudeHome, 'daemon'), { recursive: true })
    writeFileSync(join(claudeHome, 'daemon', 'roster.json'), content, 'utf-8')
  }

  it('reads the supervisor and counts the workers', () => {
    writeRoster(
      JSON.stringify({
        proto: 1,
        supervisorPid: 815032,
        updatedAt: 1782887805741,
        workers: { 'worker-1': {}, 'worker-2': {} },
      }),
    )

    expect(readRoster(claudeHome)).toEqual({
      supervisorPid: 815032,
      updatedAt: 1782887805741,
      workerCount: 2,
    })
  })

  it('reads an empty roster', () => {
    writeRoster(JSON.stringify({ proto: 1, supervisorPid: 815032, updatedAt: 1782887805741, workers: {} }))

    expect(readRoster(claudeHome)?.workerCount).toBe(0)
  })

  it('returns nothing when the roster is absent', () => {
    expect(readRoster(claudeHome)).toBeNull()
  })

  it('returns nothing when the roster is malformed', () => {
    writeRoster('{ not json')

    expect(readRoster(claudeHome)).toBeNull()
  })
})
