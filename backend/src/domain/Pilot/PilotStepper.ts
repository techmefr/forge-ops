import type { PilotAct, PilotObservation, PilotRun } from './Pilot.js'
import type { DestinationPolicy } from './PilotDestination.js'
import type { PilotBrowsers, PilotRunStore } from './PilotRunStore.js'
import type { PilotStatements } from './PilotStatements.js'
import { PilotRunOverError } from './PilotViolation.js'

type Performed = { outcome: PilotAct['outcome']; seen: PilotObservation }

export function createPilotStepper(
  { insertAct, moveCursor, endRun }: PilotStatements,
  { walking, reload }: Pick<PilotRunStore, 'walking' | 'reload'>,
  { browserOf, forget }: Pick<PilotBrowsers, 'browserOf' | 'forget'>,
  destinations: DestinationPolicy | undefined,
) {
  async function perform(run: PilotRun, step: PilotRun['script'][number]): Promise<Performed> {
    try {
      if (destinations !== undefined && step.kind === 'goto') {
        await destinations.assertAllowed(step.target ?? '', run.storyId)
      }
      const seen = await browserOf(run).perform(step)
      return { outcome: seen.consoleErrors.length > 0 ? 'failed' : 'passed', seen }
    } catch (error) {
      return {
        outcome: 'failed',
        seen: {
          detail: error instanceof Error ? error.message : String(error),
          screenshotPath: null,
          consoleErrors: [],
        },
      }
    }
  }

  async function advance(storyId: number): Promise<PilotRun> {
    const run = walking(storyId)
    browserOf(run)
    const step = run.script[run.position]
    if (step === undefined) {
      throw new PilotRunOverError(run.storyReference, run.state)
    }
    const { outcome, seen } = await perform(run, step)
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
  }

  return { advance }
}
