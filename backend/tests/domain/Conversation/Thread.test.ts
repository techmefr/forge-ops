import { describe, expect, it } from 'vitest'
import {
  chaptersOf,
  openingOf,
  threadOf,
  validationRefusalOf,
  voiceOf,
} from '../../../src/domain/Conversation/Thread.js'
import type { ThreadProof, ThreadSession } from '../../../src/domain/Conversation/Thread.js'
import type { StoryRemark, TemplateColumn } from '../../../../contract/BoardContract.js'
import type { Story } from '../../../../contract/StoryContract.js'

function column(prompt: string | null, agent: string | null = 'architect'): TemplateColumn {
  return { state: 'backlog', label: 'Reserve', colour: 'line', agent, prompt, delayHours: null }
}

function story(state: Story['state'] = 'drafting'): Story {
  return {
    id: 1,
    epicId: 1,
    twinOfStoryId: null,
    reference: 'FORGE-1',
    title: 'the card is the conversation',
    body: 'one thread from the first question to the ship',
    kind: 'functional',
    state,
    points: null,
    rolloutPercent: null,
    mergeConflict: false,
    escalationReason: null,
  }
}

function remark(at: string, voice: StoryRemark['voice'], body: string): StoryRemark {
  return { id: 1, storyId: 1, author: voice === 'human' ? 'gaetan' : 'architect', voice, body, writtenAt: at }
}

function session(startedAt: string, phase: string): ThreadSession {
  return { claudeSessionId: `cs-${phase}`, phase, agentName: 'claude', startedAt }
}

function proof(at: string, name: string): ThreadProof {
  return { name, provenAt: at, evidencePath: `.forge/${name}.json` }
}

describe('the opening of the conversation', () => {
  it('comes from the first column of the template', () => {
    expect(openingOf([column('Write the specification of {reference}')], story())).toEqual({
      agent: 'architect',
      prompt: 'Write the specification of FORGE-1',
    })
  })

  it('carries the title and the body into the prompt', () => {
    const opening = openingOf([column('{title} - {body}')], story())
    expect(opening?.prompt).toBe(
      'the card is the conversation - one thread from the first question to the ship',
    )
  })

  it('is nothing when the first column declares no prompt', () => {
    expect(openingOf([column(null)], story())).toBeNull()
    expect(openingOf([column('   ')], story())).toBeNull()
    expect(openingOf([], story())).toBeNull()
  })
})

describe('who may validate', () => {
  it('reads an agent session identifier as the agent speaking', () => {
    expect(voiceOf('cs-1')).toBe('agent')
    expect(voiceOf(null)).toBe('human')
    expect(voiceOf('')).toBe('human')
  })

  it('never lets the conversation tick its own proof', () => {
    expect(validationRefusalOf('drafting', 'agent')).toBe('AgentCannotValidate')
  })

  it('lets a human validate a story still being written', () => {
    expect(validationRefusalOf('drafting', 'human')).toBeNull()
  })

  it('refuses a second validation', () => {
    expect(validationRefusalOf('backlog', 'human')).toBe('StoryAlreadyValidated')
    expect(validationRefusalOf('building', 'human')).toBe('StoryAlreadyValidated')
  })
})

describe('the thread of a card', () => {
  it('files what was said before the first session in the writing chapter', () => {
    const chapters = chaptersOf({
      sessions: [],
      remarks: [remark('2026-09-01T10:00:00Z', 'human', 'what about the milestones')],
      proofs: [],
    })
    expect(chapters).toHaveLength(1)
    expect(chapters[0]?.phase).toBe('spec')
    expect(chapters[0]?.entries).toHaveLength(1)
  })

  it('makes the successive sessions chapters of one thread', () => {
    const chapters = chaptersOf({
      sessions: [session('2026-09-02T09:00:00Z', 'code'), session('2026-09-01T09:00:00Z', 'spec')],
      remarks: [remark('2026-09-01T10:00:00Z', 'agent', 'here is the breakdown')],
      proofs: [proof('2026-09-02T11:00:00Z', 'build_done')],
    })
    expect(chapters.map((chapter) => chapter.phase)).toEqual(['spec', 'code'])
    expect(chapters[0]?.entries.map((entry) => entry.body)).toEqual(['here is the breakdown'])
    expect(chapters[1]?.entries.map((entry) => entry.body)).toEqual(['build_done'])
  })

  it('collapses every chapter but the one in hand', () => {
    const chapters = chaptersOf({
      sessions: [session('2026-09-01T09:00:00Z', 'spec'), session('2026-09-02T09:00:00Z', 'code')],
      remarks: [],
      proofs: [],
    })
    expect(chapters.map((chapter) => chapter.collapsed)).toEqual([true, false])
  })

  it('drops the writing chapter when nothing was said before the first session', () => {
    const chapters = chaptersOf({
      sessions: [session('2026-09-01T09:00:00Z', 'spec')],
      remarks: [remark('2026-09-01T10:00:00Z', 'agent', 'done')],
      proofs: [],
    })
    expect(chapters).toHaveLength(1)
    expect(chapters[0]?.claudeSessionId).toBe('cs-spec')
  })

  it('keeps testimony and proof distinguishable', () => {
    const chapters = chaptersOf({
      sessions: [session('2026-09-01T09:00:00Z', 'spec')],
      remarks: [remark('2026-09-01T10:00:00Z', 'agent', 'the specification is written')],
      proofs: [proof('2026-09-01T11:00:00Z', 'spec_done')],
    })
    const entries = chapters[0]?.entries ?? []
    expect(entries.map((entry) => entry.kind)).toEqual(['testimony', 'proof'])
    expect(entries[0]?.evidencePath).toBeNull()
    expect(entries[1]?.evidencePath).toBe('.forge/spec_done.json')
  })

  it('reads without an agent running', () => {
    const thread = threadOf(
      story('done'),
      {
        sessions: [session('2026-09-01T09:00:00Z', 'spec')],
        remarks: [remark('2026-09-01T10:00:00Z', 'human', 'yes')],
        proofs: [],
      },
      null,
    )
    expect(thread.awaitsValidation).toBe(false)
    expect(thread.chapters).toHaveLength(1)
    expect(thread.reference).toBe('FORGE-1')
  })
})
