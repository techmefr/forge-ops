import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { decideOnHookPayload } from '../../../src/technical/Guardrail/DenyDecision.js'

const DENY_PATH = join(process.cwd(), '.claude-deny.json')

function decide(payload: unknown, denyPath: string = DENY_PATH) {
  return decideOnHookPayload(JSON.stringify(payload), denyPath)
}

describe('decideOnHookPayload', () => {
  it('lets an everyday bash command through', () => {
    expect(decide({ tool_name: 'Bash', tool_input: { command: 'npm test' } })).toEqual({ allowed: true })
  })

  it('blocks a destructive bash command', () => {
    const decision = decide({ tool_name: 'Bash', tool_input: { command: 'cd /nonexistent-probe-target && rm -rf nonexistent-probe-child' } })

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('rm -rf*')
  })

  it('blocks a destructive bash command that is not in canonical form', () => {
    const decision = decide({
      tool_name: 'Bash',
      tool_input: { command: 'git push nonexistent-probe-remote nonexistent-probe-branch --force' },
    })

    expect(decision.allowed).toBe(false)
  })

  it('keeps letting a leased force push through', () => {
    expect(
      decide({
        tool_name: 'Bash',
        tool_input: { command: 'git push nonexistent-probe-remote nonexistent-probe-branch --force-with-lease' },
      }),
    ).toEqual({ allowed: true })
  })

  it('guards the powershell tool too', () => {
    const decision = decide({
      tool_name: 'PowerShell',
      tool_input: { command: 'Remove-Item C:\\nonexistent-probe-target -Recurse -Force' },
    })

    expect(decision.allowed).toBe(false)
  })

  it('ignores a tool that runs no command', () => {
    expect(decide({ tool_name: 'Read', tool_input: { file_path: 'src/forge.ts' } })).toEqual({ allowed: true })
  })

  it('blocks when the payload is not json, rather than protecting nothing', () => {
    const decision = decideOnHookPayload('{ not json', DENY_PATH)

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('illisible')
  })

  it('blocks when the deny list is missing, rather than protecting nothing', () => {
    const decision = decide({ tool_name: 'Bash', tool_input: { command: 'npm test' } }, '/tmp/nexistepas.json')

    expect(decision.allowed).toBe(false)
    expect(decision.allowed === false && decision.reason).toContain('hors service')
  })

  it('blocks a guarded tool whose payload carries no command', () => {
    const decision = decide({ tool_name: 'Bash', tool_input: {} })

    expect(decision.allowed).toBe(false)
  })
})
