import type { StoryRepository } from '../Story/StoryRepository.js'
import { LIVE_STATES, type PilotDriver, type PilotRun, type PilotRunState, type PilotStep } from './Pilot.js'
import { toAct, type PilotStatements, type RunRow } from './PilotStatements.js'
import {
  PilotBrowserLostError,
  PilotRunNotFoundError,
  PilotRunOverError,
  PilotRunPausedError,
} from './PilotViolation.js'

export type PilotRunStore = ReturnType<typeof createPilotRunStore>
export type PilotBrowsers = ReturnType<typeof createPilotBrowsers>

export function createPilotBrowsers() {
  const drivers = new Map<number, PilotDriver>()

  return {
    attach: (runId: number, driver: PilotDriver): void => {
      drivers.set(runId, driver)
    },

    has: (runId: number): boolean => drivers.has(runId),

    browserOf: (run: PilotRun): PilotDriver => {
      const driver = drivers.get(run.id)
      if (driver === undefined) {
        throw new PilotBrowserLostError(run.storyReference)
      }
      return driver
    },

    forget: (run: PilotRun): Promise<void> => {
      const driver = drivers.get(run.id)
      drivers.delete(run.id)
      return driver === undefined ? Promise.resolve() : driver.close()
    },

    closeAll: async (): Promise<number> => {
      const open = [...drivers.values()]
      drivers.clear()
      await Promise.all(open.map((driver) => driver.close()))
      return open.length
    },
  }
}

export function createPilotRunStore(
  { selectActs, selectRun, selectForStory }: PilotStatements,
  stories: Pick<StoryRepository, 'findStory'>,
) {
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

  return { toRun, reload, liveRun, walking }
}
