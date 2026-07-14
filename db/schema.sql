CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch TEXT NOT NULL UNIQUE,
  port INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
    -- created | testing | failed | done | escalated | awaiting_human

  last_checkpoint TEXT,
    -- spec_done | plan_done | tests_written | build_done | reviewed | simplified | mr_draft_pushed

  heartbeat TIMESTAMP,
  context_summary TEXT,

  attempt_count INTEGER NOT NULL DEFAULT 0,
  action_count INTEGER NOT NULL DEFAULT 0,
  last_error_hash TEXT,

  recommended_model TEXT,
  current_model TEXT,

  escalation_reason TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat ON tasks(heartbeat);
