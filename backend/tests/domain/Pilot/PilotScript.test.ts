import { describe, expect, it } from 'vitest'
import { checkScript, MAX_SCRIPT_LENGTH } from '../../../src/domain/Pilot/PilotScript.js'
import {
  EmptyScriptError,
  ScriptTooLongError,
  StepNeedsTargetError,
  StepNeedsValueError,
  UnsafeDestinationError,
} from '../../../src/domain/Pilot/PilotViolation.js'

describe('an empty script', () => {
  it('is refused, there is nothing to watch', () => {
    expect(() => checkScript([])).toThrow(EmptyScriptError)
  })
})

describe('a goto step', () => {
  it('keeps an http destination', () => {
    expect(checkScript([{ kind: 'goto', target: 'http://localhost:5049/mails' }])[0]?.target).toBe(
      'http://localhost:5049/mails',
    )
  })

  it('refuses a destination that is not a web address', () => {
    expect(() => checkScript([{ kind: 'goto', target: 'file:///etc/passwd' }])).toThrow(
      UnsafeDestinationError,
    )
  })

  it('refuses a blank destination', () => {
    expect(() => checkScript([{ kind: 'goto', target: '  ' }])).toThrow(StepNeedsTargetError)
  })
})

describe('a click step', () => {
  it('needs something to click on', () => {
    expect(() => checkScript([{ kind: 'click', target: '' }])).toThrow(StepNeedsTargetError)
  })

  it('trims the selector, a stray space is not a selector', () => {
    expect(checkScript([{ kind: 'click', target: '  [data-test-id=send]  ' }])[0]?.target).toBe(
      '[data-test-id=send]',
    )
  })
})

describe('a fill step', () => {
  it('needs a field and what to write in it', () => {
    expect(() => checkScript([{ kind: 'fill', target: '#subject' }])).toThrow(StepNeedsValueError)
  })

  it('accepts an empty string as a deliberate erasure', () => {
    expect(checkScript([{ kind: 'fill', target: '#subject', value: '' }])[0]?.value).toBe('')
  })
})

describe('an expectText step', () => {
  it('needs the text it is looking for', () => {
    expect(() => checkScript([{ kind: 'expectText', target: 'main' }])).toThrow(StepNeedsValueError)
  })
})

describe('a screenshot step', () => {
  it('needs neither a target nor a value, it just looks', () => {
    expect(checkScript([{ kind: 'screenshot' }])).toHaveLength(1)
  })
})

describe('a very long script', () => {
  it('is refused, a review nobody can read is not a review', () => {
    const steps = Array.from({ length: MAX_SCRIPT_LENGTH + 1 }, () => ({ kind: 'screenshot' }) as const)

    expect(() => checkScript(steps)).toThrow(ScriptTooLongError)
  })

  it('accepts one right at the limit', () => {
    const steps = Array.from({ length: MAX_SCRIPT_LENGTH }, () => ({ kind: 'screenshot' }) as const)

    expect(checkScript(steps)).toHaveLength(MAX_SCRIPT_LENGTH)
  })
})
