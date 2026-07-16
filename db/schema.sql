CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
    -- identite stable du repo (remote git ou chemin racine) : deux projets ne
    -- partagent jamais un port, meme avec des branches homonymes (main, develop...)
  branch TEXT NOT NULL,
  port INTEGER NOT NULL,

  repo_path TEXT,        -- chemin disque du repo (pour lancer/detruire la worktree et son serveur)
  worktree_path TEXT,    -- chemin de la worktree git une fois creee
  run_command TEXT,      -- commande de lancement du serveur (le port lui est injecte via PORT)
  pid INTEGER,           -- PID du serveur lance par starfleet (null si arrete)
  feature TEXT,          -- groupe reliant plusieurs worktrees d'une meme feature (front + back)
  role TEXT,             -- front | back | service | other : role de la worktree dans la feature

  status TEXT NOT NULL DEFAULT 'created',
    -- created | in_progress | done | escalated | awaiting_human

  last_checkpoint TEXT,
    -- spec_done | plan_done | tests_written | build_done | reviewed | simplified | mr_draft_pushed

  context_summary TEXT,
    -- notes de worktree lisibles, tenues a jour par le dev a chaque checkpoint

  escalation_reason TEXT,
    -- renseigne quand un dev escalade manuellement une worktree bloquee

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (project, branch)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_port ON tasks(port);

CREATE TABLE IF NOT EXISTS task_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id);
