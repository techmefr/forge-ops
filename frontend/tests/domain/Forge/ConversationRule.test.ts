import { describe, expect, it } from 'vitest'
import type { StoryThread } from '@contract/ConversationContract'
import {
  concernsStory,
  foldEvent,
  groupThread,
  itemsOfThread,
  logLinesOf,
  quoteOf,
  withQuote,
  replyRouteOf,
  submitsOn,
  withoutPersisted,
  type ThreadItem,
  itemsOfPhase,
} from '@/domain/Forge/ConversationRule'

const THREAD: StoryThread = {
  toolLogs: [],
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
      { name: 'session.user', payload: { reference: ref, tools: [{ id: 't1', name: '', outcome: 'failed', input: '', output: '' }] } },
      'S-1',
    )
    expect(ended).toEqual([{ kind: 'tool', id: 't1', name: 'Read', outcome: 'failed', input: '', output: '' }])
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
  const tool: ThreadItem = { kind: 'tool', id: 't1', name: 'Read', outcome: 'ok', input: '', output: '' }

  it('drops the live lines the board already saved and keeps the rest', () => {
    expect(withoutPersisted([echoed, fresh, tool], [saved])).toEqual([fresh, tool])
  })

  it('does not merge a human line with an agent line of the same words', () => {
    const human: ThreadItem = { ...echoed, voice: 'human' }

    expect(withoutPersisted([human], [saved])).toEqual([human])
  })
})

describe('groupThread', () => {
  const said = (id: string, author: string, body: string, proof = false): ThreadItem => ({
    kind: 'message',
    id,
    voice: author === 'you' ? 'human' : 'agent',
    author,
    body,
    at: null,
    proof,
    evidencePath: proof ? `.claude/evidence/${id}.md` : null,
  })

  it('merges consecutive messages of the same author into one group', () => {
    const { blocks } = groupThread([said('a', 'agent', 'one'), said('b', 'agent', 'two'), said('c', 'you', 'three')])
    expect(blocks.map((block) => block.kind)).toEqual(['group', 'group'])
    expect(blocks[0]).toMatchObject({ author: 'agent', messages: [{ body: 'one' }, { body: 'two' }] })
  })

  it('collects every proof in one list and keeps them out of the conversation', () => {
    const { blocks, proofs } = groupThread([said('a', 'board', 'spec_done', true), said('b', 'agent', 'hi'), said('c', 'board', 'verified', true)])
    expect(proofs.map((proof) => proof.body)).toEqual(['spec_done', 'verified'])
    expect(blocks).toHaveLength(1)
  })

  it('starts a new group after a marker or a tool line', () => {
    const { blocks } = groupThread([
      said('a', 'agent', 'one'),
      { kind: 'tool', id: 't', name: 'Read', outcome: 'ok', input: '', output: '' },
      said('b', 'agent', 'two'),
    ])
    expect(blocks.map((block) => block.kind)).toEqual(['group', 'tool', 'group'])
  })
})

describe('the items of one phase', () => {
  const items: readonly ThreadItem[] = [
    { kind: 'marker', id: 'm0', phase: 'spec', agent: null },
    { kind: 'message', id: 'a', voice: 'agent', author: 'agent', body: 'spec talk', at: null, proof: false, evidencePath: null },
    { kind: 'marker', id: 'm1', phase: 'code', agent: null },
    { kind: 'message', id: 'b', voice: 'agent', author: 'agent', body: 'code talk', at: null, proof: false, evidencePath: null },
  ]

  it('keeps the marker of the phase and what follows it, up to the next marker', () => {
    expect(itemsOfPhase(items, 'spec').map((item) => item.id)).toEqual(['m0', 'a'])
    expect(itemsOfPhase(items, 'code').map((item) => item.id)).toEqual(['m1', 'b'])
  })

  it('keeps nothing for a phase that never ran', () => {
    expect(itemsOfPhase(items, 'ship')).toEqual([])
  })
})

describe('itemsOfPhase on one session that ran every step', () => {
  const message = (id: string, proof = false, body = id, at: string | null = null): ThreadItem => ({
    kind: 'message',
    id,
    voice: 'agent',
    author: 'agent',
    body,
    at,
    proof,
    evidencePath: null,
  })
  const items: readonly ThreadItem[] = [
    { kind: 'marker', id: 'm', phase: 'ship', agent: null },
    message('s1'),
    message('p1', true, 'spec_done', '10:00:01'),
    message('c1', false, 'c1', '10:00:01'),
    message('a1', false, 'a1', '10:00:09'),
    message('p2', true, 'arch_done'),
    message('b1'),
    message('p3', true, 'tests_written'),
    message('p4', true, 'build_done'),
    message('r1'),
    message('p5', true, 'verified'),
    message('p6', true, 'reviewed'),
    message('h1'),
  ]

  it('cuts the thread after the proof that closes each step', () => {
    expect(itemsOfPhase(items, 'spec').map((item) => item.id)).toEqual(['s1', 'p1', 'c1'])
    expect(itemsOfPhase(items, 'architecture').map((item) => item.id)).toEqual(['a1', 'p2'])
    expect(itemsOfPhase(items, 'code').map((item) => item.id)).toEqual(['b1', 'p3', 'p4'])
    expect(itemsOfPhase(items, 'review', ['spec', 'architecture', 'code', 'review', 'ship']).map((item) => item.id)).toEqual(['r1', 'p5', 'p6'])
  })

  it('keeps what follows the last proof for the last step', () => {
    expect(itemsOfPhase(items, 'ship').map((item) => item.id)).toEqual(['h1'])
  })

  it('keeps nothing for a step the session never reached', () => {
    expect(itemsOfPhase(items.slice(0, 3), 'code')).toEqual([])
  })
})

describe('the logs and the quote', () => {
  it('turns every kind of item into one log line', () => {
    const items: ThreadItem[] = [
      { kind: 'marker', id: 'm', phase: 'dev', agent: 'neo' },
      { kind: 'message', id: 'a', voice: 'agent', author: 'neo', body: 'Done', at: '10:00', proof: false, evidencePath: null },
      { kind: 'tool', id: 't', name: 'Read', outcome: 'failed', input: '', output: '' },
      { kind: 'notice', id: 'n', text: 'Stopped' },
    ]
    const lines = logLinesOf(items, (phase) => phase.toUpperCase())
    expect(lines.map((line) => line.text)).toEqual(['DEV · neo', '10:00 neo: Done', '✗ Read', 'Stopped'])
    expect(lines.map((line) => line.tone)).toEqual(['phase', 'agent', 'failed', 'notice'])
  })

  it('quotes a selection line by line', () => {
    expect(quoteOf('one\n\ntwo')).toBe('> one\n>\n> two')
  })

  it('appends the quote to the draft and ignores an empty selection', () => {
    expect(withQuote('', 'log line')).toBe('> log line\n\n')
    expect(withQuote('Why?', 'log line')).toBe('Why?\n\n> log line\n\n')
    expect(withQuote('Why?', '  ')).toBe('Why?')
  })
})

describe('the raw output of the tools', () => {
  it('slots each tool log into the chapter of its session, in time order', () => {
    const thread: StoryThread = {
      reference: 'S-9',
      state: 'building',
      opening: null,
      awaitsValidation: false,
      chapters: [
        {
          phase: 'dev',
          claudeSessionId: 'c-1',
          agentName: 'neo',
          openedAt: '2026-10-13 10:00:00',
          collapsed: false,
          entries: [
            { kind: 'message', at: '2026-10-13 10:00:05', author: 'neo', voice: 'agent', body: 'Reading', evidencePath: null },
            { kind: 'message', at: '2026-10-13 10:00:30', author: 'neo', voice: 'agent', body: 'Done', evidencePath: null },
          ],
        },
      ],
      toolLogs: [
        { id: 't1', claudeSessionId: 'c-1', at: '2026-10-13 10:00:10', name: 'Read', input: '{}', output: 'file body', failed: false },
        { id: 't2', claudeSessionId: 'other', at: '2026-10-13 10:00:12', name: 'Bash', input: '', output: '', failed: true },
      ],
    }
    const items = itemsOfThread(thread)
    expect(items.map((item) => item.kind)).toEqual(['marker', 'message', 'tool', 'message'])
    expect(items[2]).toMatchObject({ id: 't1', name: 'Read', output: 'file body' })
  })

  it('shows the input and the output under the tool line, and drops a live duplicate', () => {
    const tool: ThreadItem = { kind: 'tool', id: 't1', name: 'Bash', outcome: 'ok', input: 'ls', output: 'a.ts' }
    expect(logLinesOf([tool], (phase) => phase)[0]?.detail).toBe('ls\n\na.ts')
    expect(withoutPersisted([tool], [tool])).toEqual([])
  })
})
