CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch TEXT NOT NULL UNIQUE,
  port INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
    -- created | in_progress | done | escalated | awaiting_human

  last_checkpoint TEXT,
    -- spec_done | plan_done | tests_written | build_done | reviewed | simplified | mr_draft_pushed

  context_summary TEXT,
    -- notes de worktree lisibles, tenues a jour par le dev a chaque checkpoint

  escalation_reason TEXT,
    -- renseigne quand un dev escalade manuellement une worktree bloquee

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
