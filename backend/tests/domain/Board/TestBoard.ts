import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

export type TestBoard = {
  api: Hono
}

export function buildTestBoard(db: Database.Database): TestBoard {
  return {
    api: createBoardApi({
      repository: createStoryRepository(db),
      agentSessions: createAgentSessionRepository(db),
      checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
        takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
      }),
      criteria: createCriterionRepository(db),
      zones: createZoneRepository(db),
      budget: createBudgetRepository(db),
      events: createEventBus(),
      dispatcher: {
        dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
        countRunning: () => 0,
      },
      claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
      cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
      advanceReviewCascade: () =>
        Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
    }),
  }
}
