import { describe, expect, it } from 'vitest'
import { GATE_SCRIPTS, missingScripts, reportMissingScripts } from '../../../src/domain/Gate/RequiredScript.js'

describe('missingScripts', () => {
  it('finds nothing when every required script is declared', () => {
    expect(missingScripts({ lint: 'eslint .', test: 'vitest run' }, ['lint', 'test'])).toEqual([])
  })

  it('reports a script the manifest does not declare', () => {
    expect(missingScripts({ test: 'vitest run' }, ['lint', 'test'])).toEqual(['lint'])
  })

  it('reports a script declared with an empty command', () => {
    expect(missingScripts({ lint: '   ' }, ['lint'])).toEqual(['lint'])
  })

  it('keeps the order of the required list', () => {
    expect(missingScripts({}, ['lint', 'build:back'])).toEqual(['lint', 'build:back'])
  })

  it('guards every command the gate runs', () => {
    expect(GATE_SCRIPTS).toContain('lint')
    expect(GATE_SCRIPTS).toContain('build:back')
    expect(GATE_SCRIPTS).toContain('build:web')
  })
})

describe('reportMissingScripts', () => {
  it('names each missing script', () => {
    expect(reportMissingScripts(['lint', 'build:web'])).toContain('lint')
    expect(reportMissingScripts(['lint', 'build:web'])).toContain('build:web')
  })

  it('says the manifest is complete when nothing is missing', () => {
    expect(reportMissingScripts([])).toContain('complete')
  })
})
