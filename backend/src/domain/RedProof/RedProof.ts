export {
  RED_PROOF_OUTPUT_CAP,
  RED_PROOF_TIMEOUT_MS,
} from '../../../../contract/RedProofContract.js'
export type {
  AssertionOutcome,
  AssertionStatus,
  TestFileOutcome,
  TestReport,
} from '../../../../contract/RedProofContract.js'

export const RED_PROOF_FAILURE_CAP = 5

export type RedVerdict =
  | { kind: 'assertion'; failures: readonly string[] }
  | { kind: 'uncollected'; reasons: readonly string[] }
  | { kind: 'crashed'; crashes: readonly string[] }
  | { kind: 'green' }
  | { kind: 'empty' }
