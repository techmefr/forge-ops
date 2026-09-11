import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AGENT_PHASE_SEQUENCE } from '../../../src/domain/Agent/AgentSession.js'
import { PHASE_CONTRACTS } from '../../../src/domain/Dispatch/Dispatch.js'
import { assertEvidenceShape, MINIMUM_PROSE_WORDS } from '../../../src/domain/Evidence/EvidenceShape.js'

const DOCTRINE = new URL('../../../../.claude/commands/', import.meta.url)

const QUOTED_SECTION = /`(##\s+[^`]+)`/g
const POSTED_CHECKPOINT = /"name"\s*:\s*"([a-z_]+)"/g
const ANNOUNCED_SEQUENCE = /sequence \(`([^`]+)`\)/
const SLASH_COMMAND = /\/([A-Z][A-Z-]+)/g

const FILLER = 'prose '.repeat(MINIMUM_PROSE_WORDS)

function doctrineOf(command: string): string {
  return readFileSync(fileURLToPath(new URL(command, DOCTRINE)), 'utf8')
}

function sectionsOf(command: string): readonly string[] {
  return [...doctrineOf(command).matchAll(QUOTED_SECTION)].map((match) => match[1] ?? '')
}

function checkpointsPostedBy(command: string): readonly string[] {
  return [...doctrineOf(command).matchAll(POSTED_CHECKPOINT)].map((match) => match[1] ?? '')
}

describe('every phase names the doctrine file it follows', () => {
  it('carries one command per phase', () => {
    expect(PHASE_CONTRACTS.map((contract) => contract.phase)).toEqual([...AGENT_PHASE_SEQUENCE])
    for (const contract of PHASE_CONTRACTS) {
      expect(contract.command).toMatch(/^[A-Z][A-Z-]*\.md$/)
      expect(() => doctrineOf(contract.command)).not.toThrow()
    }
  })

  it('posts the checkpoint the contract says it proves', () => {
    for (const contract of PHASE_CONTRACTS) {
      const posted = checkpointsPostedBy(contract.command)
      if (contract.proves === null) {
        expect(posted).toEqual([])
        continue
      }
      expect(posted).toContain(contract.proves)
    }
  })
})

describe('the doctrine headings satisfy the shape the code enforces', () => {
  it('accepts a proof titled the way the command file dictates', () => {
    for (const contract of PHASE_CONTRACTS) {
      if (contract.proves === null) {
        continue
      }
      const sections = sectionsOf(contract.command)
      expect(sections.length).toBeGreaterThan(0)
      const written = [...sections.map((section) => `${section}\n${FILLER}`)].join('\n')
      expect(() =>
        assertEvidenceShape(contract.proves ?? 'spec_done', `.claude/commands/${contract.command}`, written),
      ).not.toThrow()
    }
  })

  it('states the sequence in the order the code dispatches it', () => {
    const line = ANNOUNCED_SEQUENCE.exec(doctrineOf('SPEC.md'))?.[1]
    expect(line).toBeDefined()
    const announced = [...(line ?? '').matchAll(SLASH_COMMAND)].map(
      (match) => `${match[1] ?? ''}.md`,
    )
    const ordered = PHASE_CONTRACTS.map((contract) => contract.command)
    expect(announced.filter((command) => ordered.includes(command))).toEqual(ordered)
  })
})
