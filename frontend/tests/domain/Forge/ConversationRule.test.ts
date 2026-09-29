import { describe, expect, it } from 'vitest'
import type { StoryThread } from '@contract/ConversationContract'
import {
  concernsStory,
  foldEvent,
  itemsOfThread,
  replyRouteOf,
  submitsOn,
  withoutPersisted,
  type ThreadItem,
} from '@/domain/Forge/ConversationRule'

const THREAD: StoryThread = {
  reference: 'S-1',
  state: 'building',
  opening: null,
  awaitsValidation: false,
  chapters: [
    {
      phase: 'spec',
      claudeSessionId: null,
      agentName: null,
      openedAt: null,
      collapsed: true,
      entries: [
        { kind: 'testimony', at: '2026-09-28T10:00:00Z', author: 'ana', voice: 'human', body: 'Please keep it small', evidencePath: null },
      ],
    },
    {
      phase: 'architecture',
      claudeSessionId: 'abc',
      agentName: 'architecte',
      openedAt: '2026-09-28T11:00:00Z',
      collapsed: false,
      entries: [
        { kind: 'proof', at: '2026-09-28T11:30:00Z', author: 'board', voice: 'agent', body: 'spec_done', evidencePath: '.claude/evidence/S-1/spec.md' },
      ],
    },
  ],
}

describe('itemsOfThread', () => {
  it('opens each chapter with a step marker, then lists its entries', () => {
    const items = itemsOfThread(THREAD)
    expect(items.map((item) => item.kind)).toEqual(['marker', 'message', 'marker', 'message'])
    expect(items[2]).toMatchObject({ kind: 'marker', phase: 'architecture', agent: 'architecte' })
  })

  it('tells a proof from a testimony', () => {
    const [, testimony, , proof] = itemsOfThread(THREAD)
    expect(testimony).toMatchObject({ voice: 'human', proof: false })
    expect(proof).toMatchObject({ voice: 'agent', proof: true, evidencePath: '.claude/evidence/S-1/spec.md' })
  })
})

describe('concernsStory', () => {
  it('matches the story reference alone or inside a forge card reference', () => {
    expect(concernsStory('S-1', 'S-1')).toBe(true)
    expect(concernsStory('FORGE-3 (S-1, S-2)', 'S-2')).toBe(true)
    expect(concernsStory('FORGE-3 (S-10)', 'S-1')).toBe(false)
    expect(concernsStory(undefined, 'S-1')).toBe(false)
  })
})

describe('foldEvent', () => {
  const ref = 'FORGE-1 (S-1)'

  it('adds what the agent says', () => {
    const items = foldEvent([], { name: 'session.assistant', payload: { reference: ref, text: 'I read the spec' } }, 'S-1')
    expect(items).toMatchObject([{ kind: 'message', voice: 'agent', body: 'I read the spec' }])
  })

  it('adds what the person says', () => {
    const items = foldEvent([], { name: 'session.human', payload: { reference: 'S-1', text: 'go on' } }, 'S-1')
    expect(items).toMatchObject([{ kind: 'message', voice: 'human', body: 'go on' }])
  })

  it('follows a tool from its start to its end, by id', () => {
    const started = foldEvent(
      [],
      { name: 'session.assistant', payload: { reference: ref, tools: [{ id: 't1', name: 'Read', outcome: 'started' }] } },
      'S-1',
    )
    const ended = foldEvent(
      started,
      { name: 'session.user', payload: { reference: ref, tools: [{ id: 't1', name: '', outcome: 'failed' }] } },
      'S-1',
    )
    expect(ended).toEqual([{ kind: 'tool', id: 't1', name: 'Read', outcome: 'failed' }])
  })

  it('ignores the events of another story and the ones it does not show', () => {
    const other = foldEvent([], { name: 'session.assistant', payload: { reference: 'S-9', text: 'hi' } }, 'S-1')
    const result = foldEvent([], { name: 'session.result', payload: { reference: ref } }, 'S-1')
    expect(other).toEqual([])
    expect(result).toEqual([])
  })

  it('reports a failed session as a notice', () => {
    const items: readonly ThreadItem[] = foldEvent([], { name: 'session.failed', payload: { reference: ref, message: 'boom' } }, 'S-1')
    expect(items).toMatchObject([{ kind: 'notice', text: 'boom' }])
  })

  it('does not show the user turn text again, the human event carries it', () => {
    const items = foldEvent([], { name: 'session.user', payload: { reference: ref, text: 'go on' } }, 'S-1')
    expect(items).toEqual([])
  })
})

describe('the reply box', () => {
  it('adds a note in the backlog and in a human step, talks to the agent elsewhere', () => {
    expect(replyRouteOf('backlog', false)).toBe('note')
    expect(replyRouteOf('step', true)).toBe('note')
    expect(replyRouteOf('step', false)).toBe('talk')
  })

  it('sends on Enter, adds a line on Shift+Enter, waits while composing', () => {
    expect(submitsOn('Enter', false, false)).toBe(true)
    expect(submitsOn('Enter', true, false)).toBe(false)
    expect(submitsOn('Enter', false, true)).toBe(false)
    expect(submitsOn('a', false, false)).toBe(false)
  })
})

describe('withoutPersisted', () => {
  const saved: ThreadItem = { kind: 'message', id: 'a', voice: 'agent', author: 'architect', body: 'Done reading', at: '2026-09-29 10:00:00', proof: false, evidencePath: null }
  const echoed: ThreadItem = { ...saved, id: 'live-1', at: null, body: ' Done reading ' }
  const fresh: ThreadItem = { ...saved, id: 'live-2', at: null, body: 'Next question' }
  const tool: ThreadItem = { kind: 'tool', id: 't1', name: 'Read', outcome: 'ok' }

  it('drops the live lines the board already saved and keeps the rest', () => {
    expect(withoutPersisted([echoed, fresh, tool], [saved])).toEqual([fresh, tool])
  })

  it('does not merge a human line with an agent line of the same words', () => {
    const human: ThreadItem = { ...echoed, voice: 'human' }

    expect(withoutPersisted([human], [saved])).toEqual([human])
  })
})
