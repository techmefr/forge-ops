import { beforeEach, describe, expect, it } from 'vitest'

process.env.STARFLEET_DB_PATH = ':memory:'

const { getDb } = await import('../src/db/connection.js')
const {
  cleanupTask,
  createTask,
  escalateTask,
  getTaskByBranch,
  getUsedPorts,
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

  it('keeps the original port when the same branch is created again', () => {
    createTask('feature/login', 4123)
    const again = createTask('feature/login', 9999)
    expect(again.port).toBe(4123)
  })

  it('returns null for an unknown branch', () => {
    expect(getTaskByBranch('does/not-exist')).toBeNull()
  })
})

describe('getUsedPorts', () => {
  it('returns every allocated port', () => {
    createTask('feature/a', 4001)
    createTask('feature/b', 4002)
    expect(getUsedPorts().sort()).toEqual([4001, 4002])
  })
})

describe('updateCheckpoint', () => {
  it('moves status to in_progress on intermediate checkpoints', () => {
    createTask('feature/login', 4123)
    const task = updateCheckpoint('feature/login', 'spec_done', 'perimetre acte')
    expect(task?.lastCheckpoint).toBe('spec_done')
    expect(task?.status).toBe('in_progress')
    expect(task?.contextSummary).toBe('perimetre acte')
  })

  it('moves status to awaiting_human on the final checkpoint', () => {
    createTask('feature/login', 4123)
    const task = updateCheckpoint('feature/login', 'mr_draft_pushed', 'MR ouverte en draft')
    expect(task?.status).toBe('awaiting_human')
  })
})

describe('escalateTask / cleanupTask', () => {
  it('escalates with a reason', () => {
    createTask('feature/login', 4123)
    const task = escalateTask('feature/login', 'blocage_infra')
    expect(task?.status).toBe('escalated')
    expect(task?.escalationReason).toBe('blocage_infra')
  })

  it('removes the task row', () => {
    createTask('feature/login', 4123)
    expect(cleanupTask('feature/login')).toBe(true)
    expect(getTaskByBranch('feature/login')).toBeNull()
  })
})
