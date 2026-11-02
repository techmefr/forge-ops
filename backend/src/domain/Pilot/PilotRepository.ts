import type Database from 'better-sqlite3'
import type { StoryRepository } from '../Story/StoryRepository.js'
import {
  LIVE_STATES,
  type DestinationGuard,
  type PilotDriver,
  type PilotObservation,
  type PilotOrder,
  type PilotRun,
} from './Pilot.js'
import type { DestinationPolicy } from './PilotDestination.js'
import { checkDestination, checkScript } from './PilotScript.js'
import { createPilotBrowsers, createPilotRunStore } from './PilotRunStore.js'
import { preparePilotStatements } from './PilotStatements.js'
import { createPilotStepper } from './PilotStepper.js'
import { PilotRunAlreadyLiveError } from './PilotViolation.js'

export type PilotRepository = {
  start: (order: PilotOrder) => Promise<PilotRun>
  advance: (storyId: number) => Promise<PilotRun>
  pause: (storyId: number) => PilotRun
  resume: (storyId: number) => PilotRun
  inspect: (storyId: number) => Promise<PilotObservation>
  abandon: (storyId: number) => Promise<PilotRun>
  findForStory: (storyId: number) => PilotRun | null
  history: (storyId: number) => readonly PilotRun[]
  listLive: () => readonly PilotRun[]
  abandonOrphans: () => number
  closeBrowsers: () => Promise<number>
}

export type PilotRepositoryInput = {
  stories: StoryRepository
  openDriver: (guard: DestinationGuard) => PilotDriver
  destinations?: DestinationPolicy
}

export function createPilotRepository(
  db: Database.Database,
  { stories, openDriver, destinations }: PilotRepositoryInput,
): PilotRepository {
  const statements = preparePilotStatements(db)
  const { insertRun, selectLiveForStory, selectLive, selectForStory, changeState, endRun } = statements
  const browsers = createPilotBrowsers()
  const store = createPilotRunStore(statements, stories)
  const { toRun, reload, liveRun } = store
  const { advance } = createPilotStepper(statements, store, browsers, destinations)

  async function start(order: PilotOrder): Promise<PilotRun> {
    const story = stories.findStory(order.storyId)
    const url = checkDestination(order.url)
    const script = checkScript(order.script)
    if (destinations !== undefined) {
      await destinations.assertAllowed(url, order.storyId)
      for (const step of script) {
        if (step.kind === 'goto') {
          await destinations.assertAllowed(step.target ?? '', order.storyId)
        }
      }
    }
    if (selectLiveForStory.get(order.storyId) !== undefined) {
      throw new PilotRunAlreadyLiveError(story.reference)
    }
    const written = insertRun.run(order.storyId, url, order.pace, JSON.stringify(script))
    const runId = Number(written.lastInsertRowid)
    const driver = openDriver((target) =>
      destinations === undefined ? Promise.resolve(true) : destinations.isAllowed(target, order.storyId),
    )
    browsers.attach(runId, driver)
    await driver.open(url, order.pace)
    return reload(runId)
  }

  function setState(storyId: number, state: string): PilotRun {
    const run = liveRun(storyId)
    changeState.run(state, run.id)
    return reload(run.id)
  }

  return {
    start,
    advance,
    pause: (storyId) => setState(storyId, 'paused'),
    resume: (storyId) => setState(storyId, 'running'),
    inspect: async (storyId) => browsers.browserOf(liveRun(storyId)).inspect(),

    abandon: async (storyId) => {
      const run = liveRun(storyId)
      endRun.run('abandoned', run.id)
      await browsers.forget(run)
      return reload(run.id)
    },

    findForStory: (storyId) => {
      const row = selectLiveForStory.get(storyId)
      return row === undefined ? null : toRun(row)
    },

    history: (storyId) => selectForStory.all(storyId).map(toRun),
    listLive: () => selectLive.all().map(toRun),
    closeBrowsers: () => browsers.closeAll(),

    abandonOrphans: () =>
      selectLive
        .all()
        .filter((row) => !browsers.has(row.id))
        .reduce((count, row) => count + endRun.run('abandoned', row.id).changes, 0),
  }
}

export { LIVE_STATES }
