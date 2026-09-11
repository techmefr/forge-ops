import {
  RED_PROOF_FAILURE_CAP,
  type AssertionOutcome,
  type RedVerdict,
  type TestFileOutcome,
  type TestReport,
} from './RedProof.js'

const ASSERTION_MARK = /\b\w*AssertionError\b/

function failedAssertionsOf(file: TestFileOutcome): readonly AssertionOutcome[] {
  return file.assertions.filter((assertion) => assertion.status === 'failed')
}

function isAssertionFailure(assertion: AssertionOutcome): boolean {
  return assertion.failureMessages.some((message) => ASSERTION_MARK.test(message))
}

function describeAssertion(file: TestFileOutcome, assertion: AssertionOutcome): string {
  return `${file.name} > ${assertion.fullName}`
}

function firstLineOf(message: string): string {
  return message.split(/\r?\n/)[0] ?? message
}

export function redVerdictOf(report: TestReport): RedVerdict {
  const uncollected = report.files.filter(
    (file) => file.assertions.length === 0 && file.message.trim().length > 0,
  )
  if (uncollected.length > 0) {
    return {
      kind: 'uncollected',
      reasons: uncollected
        .slice(0, RED_PROOF_FAILURE_CAP)
        .map((file) => `${file.name} : ${firstLineOf(file.message)}`),
    }
  }

  if (report.files.every((file) => file.assertions.length === 0)) {
    return { kind: 'empty' }
  }

  const failed = report.files.flatMap((file) =>
    failedAssertionsOf(file).map((assertion) => ({ file, assertion })),
  )
  if (failed.length === 0) {
    return { kind: 'green' }
  }

  const asserted = failed.filter((entry) => isAssertionFailure(entry.assertion))
  if (asserted.length === 0) {
    return {
      kind: 'crashed',
      crashes: failed
        .slice(0, RED_PROOF_FAILURE_CAP)
        .map((entry) => `${describeAssertion(entry.file, entry.assertion)} : ${firstLineOf(entry.assertion.failureMessages[0] ?? '')}`),
    }
  }

  return {
    kind: 'assertion',
    failures: asserted
      .slice(0, RED_PROOF_FAILURE_CAP)
      .map((entry) => describeAssertion(entry.file, entry.assertion)),
  }
}

export function describeRedVerdict(verdict: RedVerdict): string {
  if (verdict.kind === 'assertion') {
    return `assertions en echec : ${verdict.failures.join(' ; ')}`
  }
  if (verdict.kind === 'uncollected') {
    return `des fichiers de test n'ont pas pu etre charges : ${verdict.reasons.join(' ; ')}`
  }
  if (verdict.kind === 'crashed') {
    return `le rouge vient d'un plantage, pas d'une assertion : ${verdict.crashes.join(' ; ')}`
  }
  if (verdict.kind === 'green') {
    return "aucun test n'est rouge, la suite est verte"
  }
  return 'la suite ne porte aucun test'
}
