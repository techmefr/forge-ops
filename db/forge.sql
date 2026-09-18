PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  integration_branch TEXT NOT NULL,
  colour TEXT NOT NULL,
  checkout_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS epic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES project(id),
  title TEXT NOT NULL,
  business_intent TEXT NOT NULL,
  assignee TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS story (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_id INTEGER NOT NULL REFERENCES epic(id),
  twin_of_story_id INTEGER REFERENCES story(id),
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('functional', 'test')),
  state TEXT NOT NULL DEFAULT 'drafting' CHECK (state IN (
    'drafting',
    'backlog',
    'architecture',
    'plan_review',
    'building',
    'gating',
    'reviewing',
    'shipping',
    'flagged',
    'done',
    'escalated'
  )),
  points INTEGER CHECK (points IS NULL OR points > 0),
  rollout_percent INTEGER CHECK (rollout_percent IS NULL OR rollout_percent BETWEEN 0 AND 100),
  merge_conflict INTEGER NOT NULL DEFAULT 0 CHECK (merge_conflict IN (0, 1)),
  escalation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (twin_of_story_id IS NULL OR kind = 'test'),
  CHECK (escalation_reason IS NULL OR state = 'escalated')
);

CREATE INDEX IF NOT EXISTS idx_story_state ON story(state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_twin ON story(twin_of_story_id)
  WHERE twin_of_story_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS story_dependency (
  blocked_story_id INTEGER NOT NULL REFERENCES story(id),
  blocking_story_id INTEGER NOT NULL REFERENCES story(id),
  PRIMARY KEY (blocked_story_id, blocking_story_id),
  CHECK (blocked_story_id <> blocking_story_id)
);

CREATE TABLE IF NOT EXISTS acceptance_criterion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  reference TEXT NOT NULL,
  statement TEXT NOT NULL,
  persona TEXT,
  expects_refusal INTEGER NOT NULL DEFAULT 0 CHECK (expects_refusal IN (0, 1)),
  satisfied_at TEXT,
  evidence_path TEXT,
  UNIQUE (story_id, reference),
  CHECK (satisfied_at IS NULL OR evidence_path IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS checkpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  name TEXT NOT NULL CHECK (name IN (
    'spec_done',
    'arch_done',
    'tests_written',
    'build_done',
    'verified',
    'reviewed'
  )),
  proven_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evidence_path TEXT NOT NULL,
  UNIQUE (story_id, name)
);

CREATE TABLE IF NOT EXISTS story_step_back (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  asked_by TEXT NOT NULL,
  revoked_checkpoints TEXT NOT NULL DEFAULT '',
  stepped_back_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_story_step_back_story ON story_step_back(story_id, id);

CREATE TABLE IF NOT EXISTS worktree (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL UNIQUE REFERENCES story(id),
  path TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL UNIQUE,
  base_ref TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TEXT
);

CREATE TABLE IF NOT EXISTS port_reservation (
  port INTEGER PRIMARY KEY,
  worktree_id INTEGER NOT NULL UNIQUE REFERENCES worktree(id),
  subdomain TEXT NOT NULL UNIQUE,
  reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  CHECK (port BETWEEN 4000 AND 5999)
);

CREATE TABLE IF NOT EXISTS agent_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  claude_session_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL CHECK (phase IN (
    'spec',
    'architecture',
    'tdd',
    'code',
    'gate',
    'review',
    'ship'
  )),
  agent_name TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'starting' CHECK (lifecycle IN (
    'starting',
    'working',
    'awaiting_human',
    'finished',
    'failed',
    'interrupted'
  )),
  claude_code_version TEXT NOT NULL,
  outcome TEXT CHECK (outcome IS NULL OR outcome IN (
    'succeeded',
    'failed',
    'interrupted',
    'killed',
    'timed_out',
    'budget_exhausted',
    'permission_denied',
    'looping',
    'awaiting_human',
    'runner_missing',
    'unknown'
  )),
  cost_usd REAL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat_at TEXT,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_session_story ON agent_session(story_id);
CREATE INDEX IF NOT EXISTS idx_agent_session_lifecycle ON agent_session(lifecycle);

CREATE TABLE IF NOT EXISTS file_touch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  agent_session_id INTEGER NOT NULL REFERENCES agent_session(id),
  path TEXT NOT NULL,
  touched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_touch_path ON file_touch(path);

CREATE TABLE IF NOT EXISTS zone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES project(id),
  path_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  summary TEXT,
  summarised_at TEXT,
  UNIQUE (project_id, path_prefix)
);

CREATE TABLE IF NOT EXISTS review_pass (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  lens TEXT NOT NULL CHECK (lens IN ('quality', 'security', 'accessibility')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'running', 'passed')),
  agent_session_id INTEGER REFERENCES agent_session(id),
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (story_id, lens),
  CHECK (state <> 'passed' OR finished_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS review_finding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  agent_session_id INTEGER NOT NULL REFERENCES agent_session(id),
  lens TEXT NOT NULL CHECK (lens IN ('quality', 'security', 'accessibility')),
  severity TEXT NOT NULL CHECK (severity IN ('strong', 'weak')),
  path TEXT NOT NULL,
  line INTEGER,
  statement TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_finding_story ON review_finding(story_id);

CREATE TABLE IF NOT EXISTS incident_origin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sentry', 'user_report', 'idea', 'manual')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_id INTEGER NOT NULL REFERENCES incident_origin(id),
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'refused')),
  story_id INTEGER REFERENCES story(id),
  refusal_reason TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (origin_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_incident_state ON incident(state);

CREATE TABLE IF NOT EXISTS board_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'architect' CHECK (role IN ('director', 'architect')),
  external_subject TEXT UNIQUE,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_board_user_email ON board_user(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS board_session (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES board_user(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_board_session_user ON board_session(user_id);

CREATE TABLE IF NOT EXISTS test_census (
  story_id INTEGER PRIMARY KEY REFERENCES story(id),
  tests INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  tautologies INTEGER NOT NULL,
  taken_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS board_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scope_reservation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  path_prefix TEXT NOT NULL,
  symbols TEXT NOT NULL DEFAULT '',
  reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  renewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  UNIQUE (story_id, path_prefix)
);

CREATE INDEX IF NOT EXISTS idx_scope_reservation_live ON scope_reservation(released_at);

CREATE TABLE IF NOT EXISTS pilot_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  url TEXT NOT NULL,
  pace TEXT NOT NULL CHECK (pace IN ('live', 'slow', 'step')),
  state TEXT NOT NULL DEFAULT 'running' CHECK (state IN ('running', 'paused', 'passed', 'failed', 'abandoned')),
  script TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  CHECK (state IN ('running', 'paused') OR ended_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_pilot_run_story ON pilot_run(story_id, state);

CREATE TABLE IF NOT EXISTS pilot_act (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_run_id INTEGER NOT NULL REFERENCES pilot_run(id),
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  target TEXT,
  value TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('passed', 'failed')),
  detail TEXT NOT NULL,
  screenshot_path TEXT,
  acted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pilot_act_run ON pilot_act(pilot_run_id, position);

CREATE TABLE IF NOT EXISTS story_remark (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  author TEXT NOT NULL,
  voice TEXT NOT NULL CHECK (voice IN ('human', 'agent')),
  body TEXT NOT NULL,
  written_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_remark_story ON story_remark(story_id, id);

CREATE TABLE IF NOT EXISTS story_hold (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES story(id),
  reason TEXT NOT NULL,
  asked_by TEXT NOT NULL,
  raised_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lifted_at TEXT,
  lifted_by_remark_id INTEGER REFERENCES story_remark(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_hold_open ON story_hold(story_id) WHERE lifted_at IS NULL;

CREATE TABLE IF NOT EXISTS epic_milestone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_id INTEGER NOT NULL REFERENCES epic(id),
  kind TEXT NOT NULL CHECK (kind IN ('demo', 'production', 'everyone')),
  due_on TEXT NOT NULL,
  UNIQUE (epic_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_epic_milestone_epic ON epic_milestone(epic_id, due_on);

CREATE TABLE IF NOT EXISTS column_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (slug, version)
);

CREATE TABLE IF NOT EXISTS template_column (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES column_template(id),
  position INTEGER NOT NULL,
  state TEXT NOT NULL,
  label TEXT NOT NULL,
  colour TEXT NOT NULL,
  agent TEXT,
  prompt TEXT,
  delay_hours INTEGER,
  UNIQUE (template_id, position),
  UNIQUE (template_id, state)
);

CREATE TABLE IF NOT EXISTS project_template (
  project_id INTEGER PRIMARY KEY REFERENCES project(id),
  template_id INTEGER NOT NULL REFERENCES column_template(id),
  adopted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merge_batch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES project(id),
  branch TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'shipped')),
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_story (
  batch_id INTEGER NOT NULL REFERENCES merge_batch(id),
  story_id INTEGER NOT NULL REFERENCES story(id),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_story_story ON batch_story(story_id);
