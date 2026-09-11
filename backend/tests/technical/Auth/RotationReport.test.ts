import { describe, expect, it } from 'vitest'
import { buildRotationReport } from '../../../src/technical/Auth/RotationReport.js'

const report = (): string => buildRotationReport({ tokenPath: '.forge-token' }).join('\n')

describe('buildRotationReport', () => {
  it('names the file the new token was written to', () => {
    expect(report()).toContain('.forge-token')
  })

  it('says every open board session is invalidated', () => {
    expect(report()).toMatch(/sessions du board/)
  })

  it('says every installed hook is invalidated', () => {
    expect(report()).toMatch(/hooks.+installes/)
  })

  it('explains that the hook secret is derived from the board token', () => {
    expect(report()).toContain('derive')
  })

  it('gives the exact command that reinstalls the hook', () => {
    expect(report()).toContain('npm run hook:install')
  })

  it('tells the operator the hook is only read when Claude Code starts', () => {
    expect(report()).toMatch(/redemarre/)
  })

  it('warns against committing the token or putting it in a url', () => {
    expect(report()).toContain('gitignore')
    expect(report()).toContain('url')
  })

  it('tells the operator to restart the board so it reads the new token', () => {
    expect(report()).toContain('npm run forge')
  })
})
