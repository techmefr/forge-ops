import type Database from 'better-sqlite3'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createDemoContext } from './DemoContext.js'
import { escalateOrphan, placeStories, proveCheckpoints, seedScopeReview, seedSessions, seedStoryScenarios } from './DemoActivitySteps.js'
import { seedDependencies, seedHotfixWorkflow, seedIncidents, seedRemarks, writeBudgetAndMarker } from './DemoBoardSteps.js'
import { seedPeople, seedProjectFollowUps, seedProjects, seedSpareEpics, seedZones } from './DemoCatalogSteps.js'
import { MARKER, SESSION_PLAN, ZONE_PLAN } from './DemoPlans.js'

export type DemoBoard = {
  projects: number
  stories: number
  sessions: number
  zones: number
}

export function reviveDemoSessions(db: Database.Database): number {
  const revive = db.prepare<[string]>(
    `UPDATE agent_session
        SET lifecycle = 'working', outcome = NULL, ended_at = NULL, last_heartbeat_at = datetime('now')
      WHERE claude_session_id = ?`,
  )
  let revived = 0
  SESSION_PLAN.forEach((plan, index) => {
    if (plan.exit === null) {
      revived += revive.run(`${plan.story.replace('/', '-')}-${plan.phase}-${index}`).changes
    }
  })
  return revived
}

export function seedDemoBoard(db: Database.Database): DemoBoard {
  const marker = db
    .prepare<[string], { value: string }>('SELECT value FROM board_setting WHERE key = ?')
    .get(MARKER)
  const stories = createStoryRepository(db)
  if (marker !== undefined) {
    return summaryOf(stories)
  }
  const context = createDemoContext(db)
  seedPeople(context)
  seedProjects(context)
  seedSpareEpics(context)
  seedProjectFollowUps(context)
  seedSessions(context)
  seedZones(context)
  proveCheckpoints(context)
  seedScopeReview(context)
  seedStoryScenarios(context)
  escalateOrphan(context)
  placeStories(context)
  seedHotfixWorkflow(context)
  seedDependencies(context)
  seedRemarks(context)
  seedIncidents(context)
  writeBudgetAndMarker(context)
  return summaryOf(context.stories)
}

function summaryOf(stories: ReturnType<typeof createStoryRepository>): DemoBoard {
  return {
    projects: stories.listProjects().length,
    stories: stories.listKanban().length,
    sessions: SESSION_PLAN.length,
    zones: ZONE_PLAN.length,
  }
}
