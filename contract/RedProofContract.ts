export const RED_PROOF_TIMEOUT_MS = 120_000

export const RED_PROOF_OUTPUT_CAP = 8_000_000

export type AssertionStatus = 'passed' | 'failed' | 'pending' | 'todo' | 'skipped'

export type AssertionOutcome = {
  fullName: string
  status: AssertionStatus
  failureMessages: readonly string[]
}

export type TestFileOutcome = {
  name: string
  message: string
  assertions: readonly AssertionOutcome[]
}

export type TestReport = {
  files: readonly TestFileOutcome[]
}
