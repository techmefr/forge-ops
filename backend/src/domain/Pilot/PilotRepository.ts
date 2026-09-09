import type Database from 'better-sqlite3'
import type { StoryRepository } from '../Story/StoryRepository.js'
import {
  LIVE_STATES,
  type PilotAct,
  type PilotDriver,
  type PilotObservation,
  type PilotOrder,
  type PilotRun,
  type PilotRunState,
  type PilotStep,
} from './Pilot.js'
import { checkDestination, checkScript } from './PilotScript.js'
import {
  PilotBrowserLostError,
  PilotRunAlreadyLiveError,
  PilotRunNotFoundError,
  PilotRunOverError,
  PilotRunPausedError,
} from './PilotViolation.js'

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
  openDriver: () => PilotDriver
}

type RunRow = {
  id: number
  story_id: number
  reference: string
  url: string
  pace: string
  state: string
  script: string
  position: number
  started_at: string
  ended_at: string | null
}

type ActRow = {
  id: number
  pilot_run_id: number
  position: number
  kind: string
  target: string | null
  value: string | null
  outcome: string
  detail: string
  screenshot_path: string | null
  acted_at: string
}

const RUN_SELECTION = `
  SELECT run.id, run.story_id, story.reference, run.url, run.pace, run.state, run.script,
         run.position, run.started_at, run.ended_at
  FROM pilot_run AS run
  JOIN story ON story.id = run.story_id
`

const LIVE_CLAUSE = "run.state IN ('running', 'paused')"

function toAct(row: ActRow): PilotAct {
  return {
    id: row.id,
    position: row.position,
    kind: row.kind as PilotAct['kind'],
    target: row.target,
    value: row.value,
    outcome: row.outcome as PilotAct['outcome'],
    detail: row.detail,
    screenshotPath: row.screenshot_path,
    actedAt: row.acted_at,
  }
}

export function createPilotRepository(
  db: Database.Database,
  { stories, openDriver }: PilotRepositoryInput,
): PilotRepository {
  const drivers = new Map<number, PilotDriver>()
  const insertRun = db.prepare<[number, string, string, string]>(
    'INSERT INTO pilot_run (story_id, url, pace, script) VALUES (?, ?, ?, ?)',
  )

  const insertAct = db.prepare<[number, number, string, string | null, string | null, string, string, string | null]>(
    `INSERT INTO pilot_act (pilot_run_id, position, kind, target, value, outcome, detail, screenshot_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const selectLiveForStory = db.prepare<[number], RunRow>(
    `${RUN_SELECTION} WHERE run.story_id = ? AND ${LIVE_CLAUSE}`,
  )

  const selectLive = db.prepare<[], RunRow>(`${RUN_SELECTION} WHERE ${LIVE_CLAUSE} ORDER BY run.id ASC`)

  const selectForStory = db.prepare<[number], RunRow>(
    `${RUN_SELECTION} WHERE run.story_id = ? ORDER BY run.id DESC`,
  )

  const selectRun = db.prepare<[number], RunRow>(`${RUN_SELECTION} WHERE run.id = ?`)

  const selectActs = db.prepare<[number], ActRow>(
    'SELECT * FROM pilot_act WHERE pilot_run_id = ? ORDER BY position ASC',
  )

  const moveCursor = db.prepare<[number, number]>('UPDATE pilot_run SET position = ? WHERE id = ?')

  const changeState = db.prepare<[string, number]>('UPDATE pilot_run SET state = ? WHERE id = ?')

  const endRun = db.prepare<[string, number]>(
    "UPDATE pilot_run SET state = ?, ended_at = datetime('now') WHERE id = ?",
  )

  function toRun(row: RunRow): PilotRun {
    return {
      id: row.id,
      storyId: row.story_id,
      storyReference: row.reference,
      url: row.url,
      pace: row.pace as PilotRun['pace'],
      state: row.state as PilotRunState,
      position: row.position,
      script: JSON.parse(row.script) as readonly PilotStep[],
      acts: selectActs.all(row.id).map(toAct),
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }
  }

  function reload(runId: number): PilotRun {
    const row = selectRun.get(runId)
    if (row === undefined) {
      throw new PilotRunNotFoundError(String(runId))
    }
    return toRun(row)
  }

  function liveRun(storyId: number): PilotRun {
    const story = stories.findStory(storyId)
    const latest = selectForStory.all(storyId)[0]
    if (latest === undefined) {
      throw new PilotRunNotFoundError(story.reference)
    }
    if (!LIVE_STATES.includes(latest.state as PilotRunState)) {
      throw new PilotRunOverError(story.reference, latest.state)
    }
    return toRun(latest)
  }

  function walking(storyId: number): PilotRun {
    const run = liveRun(storyId)
    if (run.state === 'paused') {
      throw new PilotRunPausedError(run.storyReference)
    }
    return run
  }

  function browserOf(run: PilotRun): PilotDriver {
    const driver = drivers.get(run.id)
    if (driver === undefined) {
      throw new PilotBrowserLostError(run.storyReference)
    }
    return driver
  }

  function forget(run: PilotRun): Promise<void> {
    const driver = drivers.get(run.id)
    drivers.delete(run.id)
    return driver === undefined ? Promise.resolve() : driver.close()
  }

  return {
    start: async (order) => {
      const story = stories.findStory(order.storyId)
      const url = checkDestination(order.url)
      const script = checkScript(order.script)
      if (selectLiveForStory.get(order.storyId) !== undefined) {
        throw new PilotRunAlreadyLiveError(story.reference)
      }
      const written = insertRun.run(order.storyId, url, order.pace, JSON.stringify(script))
      const runId = Number(written.lastInsertRowid)
      const driver = openDriver()
      drivers.set(runId, driver)
      await driver.open(url, order.pace)
      return reload(runId)
    },

    advance: async (storyId) => {
      const run = walking(storyId)
      const driver = browserOf(run)
      const step = run.script[run.position]
      if (step === undefined) {
        throw new PilotRunOverError(run.storyReference, run.state)
      }
      let outcome: PilotAct['outcome'] = 'passed'
      let seen: PilotObservation
      try {
        seen = await driver.perform(step)
        if (seen.consoleErrors.length > 0) {
          outcome = 'failed'
        }
      } catch (error) {
        outcome = 'failed'
        seen = {
          detail: error instanceof Error ? error.message : String(error),
          screenshotPath: null,
          consoleErrors: [],
        }
      }
      insertAct.run(
        run.id,
        run.position,
        step.kind,
        step.target ?? null,
        step.value ?? null,
        outcome,
        seen.detail,
        seen.screenshotPath,
      )
      const position = run.position + 1
      moveCursor.run(position, run.id)
      if (outcome === 'failed') {
        endRun.run('failed', run.id)
        await forget(run)
      } else if (position === run.script.length) {
        endRun.run('passed', run.id)
        await forget(run)
      }
      return reload(run.id)
    },

    pause: (storyId) => {
      const run = liveRun(storyId)
      changeState.run('paused', run.id)
      return reload(run.id)
    },

    resume: (storyId) => {
      const run = liveRun(storyId)
      changeState.run('running', run.id)
      return reload(run.id)
    },

    inspect: async (storyId) => {
      return browserOf(liveRun(storyId)).inspect()
    },

    abandon: async (storyId) => {
      const run = liveRun(storyId)
      endRun.run('abandoned', run.id)
      await forget(run)
      return reload(run.id)
    },

    findForStory: (storyId) => {
      const row = selectLiveForStory.get(storyId)
      return row === undefined ? null : toRun(row)
    },

    history: (storyId) => selectForStory.all(storyId).map(toRun),

    listLive: () => selectLive.all().map(toRun),

    closeBrowsers: async () => {
      const open = [...drivers.values()]
      drivers.clear()
      await Promise.all(open.map((driver) => driver.close()))
      return open.length
    },

    abandonOrphans: () =>
      selectLive
        .all()
        .filter((row) => !drivers.has(row.id))
        .reduce((count, row) => count + endRun.run('abandoned', row.id).changes, 0),
  }
}

export { LIVE_STATES }
