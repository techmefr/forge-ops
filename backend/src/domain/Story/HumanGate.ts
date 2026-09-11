export { HUMAN_GATE_STATES } from '../../../../contract/StoryContract.js'
export type {
  HumanGateReport,
  HumanGateState,
  HumanGateStatus,
  HumanGateWait,
} from '../../../../contract/StoryContract.js'

import type { HumanGateStatus, HumanGateWait } from '../../../../contract/StoryContract.js'

export const GATE_DEADLINE_MINUTES = 24 * 60

const SECONDS_PER_MINUTE = 60

const SECONDS_PER_HOUR = 3600

function statementOf(wait: HumanGateWait, waitingHours: number, overdue: boolean, deadlineMinutes: number): string {
  const opening = `${wait.reference} attend un humain depuis ${waitingHours} h a la porte ${wait.state}`
  if (!overdue) {
    return opening
  }
  return `${opening}, le delai de ${Math.round(deadlineMinutes / 60)} h est depasse`
}

export function statusOfWaits(
  waits: readonly HumanGateWait[],
  deadlineMinutes: number = GATE_DEADLINE_MINUTES,
): readonly HumanGateStatus[] {
  const deadlineSeconds = deadlineMinutes * SECONDS_PER_MINUTE
  return waits.map((wait) => {
    const waitingHours = Math.round(wait.waitingSeconds / SECONDS_PER_HOUR)
    const overdue = wait.waitingSeconds > deadlineSeconds
    return {
      ...wait,
      waitingHours,
      overdue,
      statement: statementOf(wait, waitingHours, overdue, deadlineMinutes),
    }
  })
}

export function overdueGates(
  waits: readonly HumanGateWait[],
  deadlineMinutes: number = GATE_DEADLINE_MINUTES,
): readonly HumanGateStatus[] {
  return statusOfWaits(waits, deadlineMinutes).filter((gate) => gate.overdue)
}
