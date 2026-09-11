import { spawnSync } from 'node:child_process'
import {
  RED_PROOF_OUTPUT_CAP,
  RED_PROOF_TIMEOUT_MS,
  type AssertionStatus,
  type TestFileOutcome,
  type TestReport,
} from '../../domain/RedProof/RedProof.js'

export type RedReportInput = {
  command: string
  cwd: string
  timeoutMs?: number
  outputCap?: number
}

type RawAssertion = {
  fullName?: unknown
  status?: unknown
  failureMessages?: unknown
}

type RawFile = {
  name?: unknown
  message?: unknown
  assertionResults?: unknown
}

const ASSERTION_STATUSES: readonly AssertionStatus[] = ['passed', 'failed', 'pending', 'todo', 'skipped']

function unreadable(reason: string): TestReport {
  return { files: [{ name: 'test report', message: reason, assertions: [] }] }
}

function jsonSliceOf(output: string): string | null {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return null
  }
  return output.slice(start, end + 1)
}

function statusOf(value: unknown): AssertionStatus {
  return ASSERTION_STATUSES.find((status) => status === value) ?? 'failed'
}

function messagesOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function fileOf(raw: RawFile): TestFileOutcome {
  const assertions = Array.isArray(raw.assertionResults) ? raw.assertionResults : []
  return {
    name: typeof raw.name === 'string' ? raw.name : 'unknown',
    message: typeof raw.message === 'string' ? raw.message : '',
    assertions: assertions.map((entry: RawAssertion) => ({
      fullName: typeof entry.fullName === 'string' ? entry.fullName : 'unknown',
      status: statusOf(entry.status),
      failureMessages: messagesOf(entry.failureMessages),
    })),
  }
}

export function parseRedReport(output: string): TestReport {
  const slice = jsonSliceOf(output)
  if (slice === null) {
    return unreadable("la sortie du lanceur de tests ne porte aucun rapport JSON")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(slice)
  } catch {
    return unreadable('le rapport JSON du lanceur de tests est illisible')
  }
  const results = (parsed as { testResults?: unknown }).testResults
  if (!Array.isArray(results)) {
    return { files: [] }
  }
  return { files: results.map((entry: RawFile) => fileOf(entry)) }
}

export function runRedReport({
  command,
  cwd,
  timeoutMs = RED_PROOF_TIMEOUT_MS,
  outputCap = RED_PROOF_OUTPUT_CAP,
}: RedReportInput): TestReport {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    timeout: timeoutMs,
    maxBuffer: outputCap,
    encoding: 'utf-8',
  })
  if (result.error !== undefined || result.signal !== null) {
    const cause = result.error?.message ?? result.signal
    return unreadable(`le lanceur de tests a ete interrompu avant ${timeoutMs} ms : ${cause}`)
  }
  return parseRedReport(result.stdout ?? '')
}
