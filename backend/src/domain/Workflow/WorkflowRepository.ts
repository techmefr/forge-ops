import type Database from 'better-sqlite3'
import type { WorkflowPhaseEntry } from './Workflow.js'
import { refusalOf, SEED_WORKFLOW, WORKFLOW_CONFIG_KEY } from './Workflow.js'
import { WorkflowRefusedError } from './WorkflowViolation.js'

export type WorkflowRepository = {
  readPhases: () => readonly WorkflowPhaseEntry[]
  writePhases: (phases: readonly WorkflowPhaseEntry[]) => readonly WorkflowPhaseEntry[]
}

export function createWorkflowRepository(db: Database.Database): WorkflowRepository {
  const selectSetting = db.prepare<[string], { value: string }>(
    'SELECT value FROM board_setting WHERE key = ?',
  )
  const upsertSetting = db.prepare<[string, string]>(
    `INSERT INTO board_setting (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  )

  function readPhases(): readonly WorkflowPhaseEntry[] {
    const stored = selectSetting.get(WORKFLOW_CONFIG_KEY)
    if (stored === undefined) {
      return SEED_WORKFLOW
    }
    try {
      const parsed = JSON.parse(stored.value) as WorkflowPhaseEntry[]
      return refusalOf(parsed) === null ? parsed : SEED_WORKFLOW
    } catch {
      return SEED_WORKFLOW
    }
  }

  return {
    readPhases,

    writePhases: (phases) => {
      const refusal = refusalOf(phases)
      if (refusal !== null) {
        throw new WorkflowRefusedError(refusal)
      }
      upsertSetting.run(WORKFLOW_CONFIG_KEY, JSON.stringify(phases))
      return phases
    },
  }
}
