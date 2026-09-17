export const PARAMETERLESS_PATHS: readonly string[] = [
  '/api/board/columns',
  '/api/board/holds',
  '/api/board/human-gates',
  '/api/board/kanban',
  '/api/board/mode',
  '/api/board/phases',
  '/api/board/self',
  '/api/files/conflicts',
  '/api/fleet',
  '/api/incidents',
  '/api/machine',
  '/api/origins',
  '/api/pilots',
  '/api/projects',
  '/api/scope/collisions',
  '/api/scope/reservations',
  '/api/sessions/history',
  '/api/sessions/stale',
  '/api/settings/budget',
  '/api/statistics',
  '/api/stories/backlog',
  '/api/worktrees',
]

export const PROJECT_PATHS: readonly string[] = [
  '/api/projects/:id/clashes',
  '/api/projects/:id/epics',
  '/api/projects/:id/tree',
  '/api/projects/:id/zones',
]

export const STORY_PATHS: readonly string[] = [
  '/api/stories/:id/blockers',
  '/api/stories/:id/discussion',
  '/api/stories/:id/dod',
  '/api/stories/:id/pilot',
  '/api/stories/:id/report',
  '/api/stories/:id/review',
  '/api/stories/:id/ticket',
  '/api/stories/:id/worktree',
]
