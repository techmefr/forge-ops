import type { PilotStep, PilotStepKind } from './Pilot.js'
import {
  EmptyScriptError,
  ScriptTooLongError,
  StepNeedsTargetError,
  StepNeedsValueError,
  UnsafeDestinationError,
} from './PilotViolation.js'

export const MAX_SCRIPT_LENGTH = 40

const NEEDS_TARGET: readonly PilotStepKind[] = ['goto', 'click', 'fill', 'expectText']

const NEEDS_VALUE: readonly PilotStepKind[] = ['fill', 'expectText']

const WEB_SCHEMES: readonly string[] = ['http:', 'https:']

function isWebAddress(target: string): boolean {
  try {
    return WEB_SCHEMES.includes(new URL(target).protocol)
  } catch {
    return false
  }
}

function checkStep(step: PilotStep): PilotStep {
  const target = step.target?.trim() ?? ''
  if (NEEDS_TARGET.includes(step.kind) && target === '') {
    throw new StepNeedsTargetError(step.kind)
  }
  if (step.kind === 'goto' && !isWebAddress(target)) {
    throw new UnsafeDestinationError(target)
  }
  if (NEEDS_VALUE.includes(step.kind) && step.value === undefined) {
    throw new StepNeedsValueError(step.kind)
  }
  return {
    kind: step.kind,
    ...(target === '' ? {} : { target }),
    ...(step.value === undefined ? {} : { value: step.value }),
  }
}

export function checkDestination(url: string): string {
  const target = url.trim()
  if (target === "") {
    throw new StepNeedsTargetError("goto")
  }
  if (!isWebAddress(target)) {
    throw new UnsafeDestinationError(target)
  }
  return target
}

export function checkScript(script: readonly PilotStep[]): readonly PilotStep[] {
  if (script.length === 0) {
    throw new EmptyScriptError()
  }
  if (script.length > MAX_SCRIPT_LENGTH) {
    throw new ScriptTooLongError(script.length, MAX_SCRIPT_LENGTH)
  }
  return script.map(checkStep)
}
