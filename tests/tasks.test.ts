import { beforeEach, describe, expect, it } from 'vitest'

process.env.STARFLEET_DB_PATH = ':memory:'

const { getDb } = await import('../src/db/connection.js')
const {
  ACTION_CAP,
  ATTEMPT_CAP,
  cleanupTask,
  createTask,
  escalateTask,
  findStaleTasks,
  getTaskByBranch,
  incrementAction,
  incrementAttempt,
  recordError,
  updateCheckpoint,
} = await import('../src/db/tasks.js')

beforeEach(() => {
  getDb().exec('DELETE FROM tasks')
})

describe('createTask / getTaskByBranch', () => {
  it('creates a task with default status and no checkpoint', () => {
    const task = createTask('feature/login', 4123)
    expect(task.branch).toBe('feature/login')
    expect(task.port).toBe(4123)
    expect(task.status).toBe('created')
    expect(task.lastCheckpoint).toBeNull()
  })

  it('returns null for an unknown branch', () => {
    expect(getTaskByBranch('does/not-exist')).toBeNull()
  })
})

describe('updateCheckpoint', () => {
  it('moves status to testing on intermediate checkpoints', () => {
    createTask('feature/login', 4123)
    const task = updateCheckpoint('feature/login', 'spec_done', 'perimetre acte')
    expect(task?.lastCheckpoint).toBe('spec_done')
    expect(task?.status).toBe('testing')
    expect(task?.contextSummary).toBe('perimetre acte')
  })

  it('moves status to awaiting_human on the final checkpoint', () => {
    createTask('feature/login', 4123)
    const task = updateCheckpoint('feature/login', 'mr_draft_pushed', 'MR ouverte en draft')
    expect(task?.status).toBe('awaiting_human')
  })
})

describe('incrementAttempt', () => {
  it('escalates once the attempt cap is reached', () => {
    createTask('feature/login', 4123)
    let result
    for (let i = 0; i < ATTEMPT_CAP; i += 1) {
      result = incrementAttempt('feature/login')
    }
    expect(result?.capExceeded).toBe(true)
    expect(result?.task.status).toBe('escalated')
  })
})

describe('incrementAction', () => {
  it('escalates once the action cap is reached regardless of test status', () => {
    createTask('feature/login', 4123)
    let result
    for (let i = 0; i < ACTION_CAP; i += 1) {
      result = incrementAction('feature/login')
    }
    expect(result?.capExceeded).toBe(true)
    expect(result?.task.status).toBe('escalated')
    expect(result?.task.escalationReason).toBe('action_limit_exceeded')
  })
})

describe('recordError', () => {
  it('detects a repeated error loop across two consecutive attempts', () => {
    createTask('feature/login', 4123)
    const first = recordError('feature/login', 'hash-abc')
    expect(first.isRepeatedLoop).toBe(false)
    const second = recordError('feature/login', 'hash-abc')
    expect(second.isRepeatedLoop).toBe(true)
    expect(second.task.status).toBe('escalated')
  })

  it('does not treat a different error hash as a loop', () => {
    createTask('feature/login', 4123)
    recordError('feature/login', 'hash-abc')
    const second = recordError('feature/login', 'hash-def')
    expect(second.isRepeatedLoop).toBe(false)
  })
})

describe('escalateTask / cleanupTask', () => {
  it('escalates with a reason', () => {
    createTask('feature/login', 4123)
    const task = escalateTask('feature/login', 'manual_escalation')
    expect(task?.status).toBe('escalated')
    expect(task?.escalationReason).toBe('manual_escalation')
  })

  it('removes the task row', () => {
    createTask('feature/login', 4123)
    expect(cleanupTask('feature/login')).toBe(true)
    expect(getTaskByBranch('feature/login')).toBeNull()
  })
})

describe('findStaleTasks', () => {
  it('flags tasks with no heartbeat as stale', () => {
    createTask('feature/login', 4123)
    const stale = findStaleTasks(15)
    expect(stale.some((task) => task.branch === 'feature/login')).toBe(true)
  })

  it('excludes done and escalated tasks', () => {
    createTask('feature/escalated', 4200)
    escalateTask('feature/escalated', 'manual_escalation')
    const stale = findStaleTasks(15)
    expect(stale.some((task) => task.branch === 'feature/escalated')).toBe(false)
  })
})
