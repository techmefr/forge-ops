import type Database from 'better-sqlite3'
import { DEFAULT_AUTOPILOT, type AutopilotSettings } from '../../../../contract/AutopilotContract.js'

export type PendingAction = 'advance' | 'retry'

export type AutopilotCardRecord = {
  forgeCardId: number
  stepKey: string
  attempts: number
  advances: number
  state: 'paused' | 'red' | null
  reason: string | null
  pending: PendingAction | null
  feedback: string | null
}

export type AutopilotCardPatch = Partial<Omit<AutopilotCardRecord, 'forgeCardId'>>

export type AutopilotRepository = {
  settingsOf: (projectId: number) => AutopilotSettings
  settle: (projectId: number, settings: AutopilotSettings) => AutopilotSettings
  cardOf: (forgeCardId: number) => AutopilotCardRecord
  patchCard: (forgeCardId: number, patch: AutopilotCardPatch) => AutopilotCardRecord
  resetCard: (forgeCardId: number) => void
  listPending: () => readonly AutopilotCardRecord[]
}

type SettingRow = {
  enabled: number
  auto_launch: number
  auto_publish: number
  auto_merge: number
}

type CardRow = {
  forge_card_id: number
  step_key: string
  attempts: number
  advances: number
  state: 'paused' | 'red' | null
  reason: string | null
  pending: PendingAction | null
  feedback: string | null
}

function recordOf(row: CardRow): AutopilotCardRecord {
  return {
    forgeCardId: row.forge_card_id,
    stepKey: row.step_key,
    attempts: row.attempts,
    advances: row.advances,
    state: row.state,
    reason: row.reason,
    pending: row.pending,
    feedback: row.feedback,
  }
}

function blank(forgeCardId: number): AutopilotCardRecord {
  return { forgeCardId, stepKey: '', attempts: 0, advances: 0, state: null, reason: null, pending: null, feedback: null }
}

export function createAutopilotRepository(db: Database.Database): AutopilotRepository {
  const selectSetting = db.prepare<[number], SettingRow>(
    'SELECT enabled, auto_launch, auto_publish, auto_merge FROM autopilot_setting WHERE project_id = ?',
  )
  const upsertSetting = db.prepare<[number, number, number, number, number]>(
    `INSERT INTO autopilot_setting (project_id, enabled, auto_launch, auto_publish, auto_merge)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (project_id) DO UPDATE SET
       enabled = excluded.enabled,
       auto_launch = excluded.auto_launch,
       auto_publish = excluded.auto_publish,
       auto_merge = excluded.auto_merge`,
  )
  const selectCard = db.prepare<[number], CardRow>('SELECT * FROM autopilot_card WHERE forge_card_id = ?')
  const selectPending = db.prepare<[], CardRow>(
    "SELECT * FROM autopilot_card WHERE pending IS NOT NULL AND state IS NOT 'red' ORDER BY forge_card_id",
  )
  const upsertCard = db.prepare<[number, string, number, number, string | null, string | null, string | null, string | null]>(
    `INSERT INTO autopilot_card (forge_card_id, step_key, attempts, advances, state, reason, pending, feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (forge_card_id) DO UPDATE SET
       step_key = excluded.step_key,
       attempts = excluded.attempts,
       advances = excluded.advances,
       state = excluded.state,
       reason = excluded.reason,
       pending = excluded.pending,
       feedback = excluded.feedback,
       updated_at = datetime('now')`,
  )
  const deleteCard = db.prepare<[number]>('DELETE FROM autopilot_card WHERE forge_card_id = ?')

  function cardOf(forgeCardId: number): AutopilotCardRecord {
    const row = selectCard.get(forgeCardId)
    return row === undefined ? blank(forgeCardId) : recordOf(row)
  }

  return {
    settingsOf: (projectId) => {
      const row = selectSetting.get(projectId)
      if (row === undefined) {
        return DEFAULT_AUTOPILOT
      }
      return {
        enabled: row.enabled === 1,
        autoLaunch: row.auto_launch === 1,
        autoPublish: row.auto_publish === 1,
        autoMerge: row.auto_merge === 1,
      }
    },

    settle: (projectId, settings) => {
      upsertSetting.run(
        projectId,
        settings.enabled ? 1 : 0,
        settings.autoLaunch ? 1 : 0,
        settings.autoPublish ? 1 : 0,
        settings.autoMerge ? 1 : 0,
      )
      return settings
    },

    cardOf,

    patchCard: (forgeCardId, patch) => {
      const next = { ...cardOf(forgeCardId), ...patch }
      upsertCard.run(
        forgeCardId,
        next.stepKey,
        next.attempts,
        next.advances,
        next.state,
        next.reason,
        next.pending,
        next.feedback,
      )
      return next
    },

    resetCard: (forgeCardId) => {
      deleteCard.run(forgeCardId)
    },

    listPending: () => selectPending.all().map(recordOf),
  }
}
