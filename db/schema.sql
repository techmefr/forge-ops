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

CREATE TABLE IF NOT EXISTS arch_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  path TEXT NOT NULL,          -- ou ira le fichier/module
  purpose TEXT,                -- a quoi il sert
  status TEXT NOT NULL DEFAULT 'planned',  -- planned | in_progress | done
  feature TEXT,                -- feature/worktree qui le livre
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project, path)
);

CREATE INDEX IF NOT EXISTS idx_arch_project ON arch_nodes(project);

CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,                -- resolu depuis worktree_path quand le hook ne le connait pas
  branch TEXT,
  worktree_path TEXT,          -- cwd envoye par le hook Claude Code
  session TEXT,                -- identifiant de session, pour distinguer deux agents sur la meme worktree
  tool TEXT NOT NULL,          -- nom de l'outil (Edit, Write, Bash...)
  file_path TEXT,              -- fichier touche quand l'outil en designe un
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
  -- on stocke l'evenement, jamais le contenu du transcript : ce qui est ecrit ici
  -- doit rester lisible sans fuiter le travail lui-meme

CREATE INDEX IF NOT EXISTS idx_events_recent ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_worktree ON activity_events(project, branch);

CREATE TABLE IF NOT EXISTS conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  left_branch TEXT NOT NULL,   -- paire ordonnee (left < right) pour que la cle soit stable
  right_branch TEXT NOT NULL,
  file_path TEXT NOT NULL,
  promoted INTEGER NOT NULL DEFAULT 0,
    -- 0 = simplement visible dans le tableau ; 1 = un cote a franchi un checkpoint,
    -- son code a arrete de bouger, le conflit merite une tache dediee
  arbitration TEXT,            -- branche qui devrait bouger, null quand c'est au dev de trancher
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,       -- rempli des que git merge-tree ne signale plus rien
  UNIQUE (project, left_branch, right_branch, file_path)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_open ON conflicts(project, resolved_at);
