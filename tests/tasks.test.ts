import { beforeEach, describe, expect, it } from 'vitest'

process.env.STARFLEET_DB_PATH = ':memory:'

const { getDb } = await import('../src/db/connection.js')
const {
  addTaskItem,
  cleanupTask,
  createTask,
  escalateTask,
  getTask,
  getUsedPorts,
  listTaskItems,
  toggleTaskItem,
  updateCheckpoint,
} = await import('../src/db/tasks.js')

beforeEach(() => {
  getDb().exec('DELETE FROM task_items; DELETE FROM tasks')
})

describe('createTask / getTask', () => {
  it('creates a task with default status and optional fields', () => {
    const task = createTask({
      project: 'stacktim',
      branch: 'feature/login',
      port: 4123,
      repoPath: '/home/gaetan/stacktim',
      runCommand: 'npm run dev',
      feature: 'login-sso',
    })
    expect(task.project).toBe('stacktim')
    expect(task.port).toBe(4123)
    expect(task.status).toBe('created')
    expect(task.repoPath).toBe('/home/gaetan/stacktim')
    expect(task.runCommand).toBe('npm run dev')
    expect(task.feature).toBe('login-sso')
  })

  it('keeps two projects with the same branch name separate', () => {
    const a = createTask({ project: 'stacktim', branch: 'main', port: 4001 })
    const b = createTask({ project: 'formation-laravel', branch: 'main', port: 4002 })
    expect(a.port).toBe(4001)
    expect(b.port).toBe(4002)
    expect(getTask('stacktim', 'main')?.port).toBe(4001)
    expect(getTask('formation-laravel', 'main')?.port).toBe(4002)
  })

  it('keeps the original port when the same project/branch is created again', () => {
    createTask({ project: 'stacktim', branch: 'feature/login', port: 4123 })
    const again = createTask({ project: 'stacktim', branch: 'feature/login', port: 9999 })
    expect(again.port).toBe(4123)
  })

  it('returns null for an unknown project/branch', () => {
    expect(getTask('stacktim', 'does/not-exist')).toBeNull()
  })
})

describe('getUsedPorts', () => {
  it('returns every allocated port across all projects', () => {
    createTask({ project: 'stacktim', branch: 'feature/a', port: 4001 })
    createTask({ project: 'formation-laravel', branch: 'feature/b', port: 4002 })
    expect(getUsedPorts().sort()).toEqual([4001, 4002])
  })
})

describe('updateCheckpoint', () => {
  it('moves status to in_progress on intermediate checkpoints', () => {
    createTask({ project: 'stacktim', branch: 'feature/login', port: 4123 })
    const task = updateCheckpoint('stacktim', 'feature/login', 'spec_done', 'perimetre acte')
    expect(task?.lastCheckpoint).toBe('spec_done')
    expect(task?.status).toBe('in_progress')
  })

  it('moves status to awaiting_human on the final checkpoint', () => {
    createTask({ project: 'stacktim', branch: 'feature/login', port: 4123 })
    const task = updateCheckpoint('stacktim', 'feature/login', 'mr_draft_pushed', 'MR draft')
    expect(task?.status).toBe('awaiting_human')
  })
})

describe('escalateTask / cleanupTask', () => {
  it('escalates with a reason', () => {
    createTask({ project: 'stacktim', branch: 'feature/login', port: 4123 })
    const task = escalateTask('stacktim', 'feature/login', 'blocage_infra')
    expect(task?.status).toBe('escalated')
    expect(task?.escalationReason).toBe('blocage_infra')
  })

  it('removes the task row', () => {
    createTask({ project: 'stacktim', branch: 'feature/login', port: 4123 })
    expect(cleanupTask('stacktim', 'feature/login')).toBe(true)
    expect(getTask('stacktim', 'feature/login')).toBeNull()
  })
})

describe('task items', () => {
  it('adds and toggles items, and cascades on cleanup', () => {
    const task = createTask({ project: 'stacktim', branch: 'feature/login', port: 4123 })
    const item = addTaskItem('stacktim', 'feature/login', 'Brancher le SSO')
    expect(item?.done).toBe(false)
    const toggled = toggleTaskItem(item!.id, true)
    expect(toggled?.done).toBe(true)
    expect(listTaskItems(task.id)).toHaveLength(1)
    cleanupTask('stacktim', 'feature/login')
    expect(listTaskItems(task.id)).toHaveLength(0)
  })

  it('returns null when adding an item to an unknown worktree', () => {
    expect(addTaskItem('stacktim', 'ghost', 'x')).toBeNull()
  })
})
