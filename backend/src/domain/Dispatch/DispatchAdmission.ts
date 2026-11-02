import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import { BudgetExhaustedError } from '../Budget/BudgetViolation.js'
import type { Clock, DispatchRate, createRateBucket } from './DispatchRate.js'
import { DispatchTooFastError, FleetSaturatedError } from './DispatchViolation.js'

export type Admission = {
  takenAt: number
  decision: ReturnType<BudgetRepository['decideConduct']>
}

type AdmissionInput = {
  budget: BudgetRepository
  bucket: ReturnType<typeof createRateBucket>
  rate: DispatchRate
  clock: Clock
  concurrencyCap: number
  countRunning: () => number
}

export function createDispatchAdmission({ budget, bucket, rate, clock, concurrencyCap, countRunning }: AdmissionInput) {
  return {
    admit: (waitingCount: number): Admission => {
      const running = countRunning() - waitingCount
      if (running >= concurrencyCap) {
        throw new FleetSaturatedError(running, concurrencyCap)
      }
      const takenAt = clock()
      if (!bucket.take(takenAt)) {
        throw new DispatchTooFastError(rate.burst, rate.windowMs)
      }
      const decision = budget.decideConduct()
      if (decision.conduct === 'stop') {
        bucket.refund(takenAt)
        throw new BudgetExhaustedError(decision.spentUsd, decision.capUsd)
      }
      return { takenAt, decision }
    },
  }
}
