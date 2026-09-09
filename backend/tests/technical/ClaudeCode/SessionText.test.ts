import { describe, expect, it } from 'vitest'
import { textOf } from '../../../src/technical/ClaudeCode/SdkSessionRunner.js'

describe('textOf', () => {
  it('reads what the assistant said', () => {
    expect(
      textOf({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'je propose de decouper en trois stories' }] },
      }),
    ).toBe('je propose de decouper en trois stories')
  })

  it('joins several blocks, so nothing said is dropped', () => {
    expect(
      textOf({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'premier point' },
            { type: 'text', text: 'second point' },
          ],
        },
      }),
    ).toBe('premier point\n\nsecond point')
  })

  it('ignores a tool call, which is not something said', () => {
    expect(
      textOf({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] },
      }),
    ).toBeNull()
  })

  it('reads a plain string content', () => {
    expect(textOf({ type: 'assistant', message: { content: 'bonjour' } })).toBe('bonjour')
  })

  it('says nothing about a message with no content', () => {
    expect(textOf({ type: 'system' })).toBeNull()
  })

  it('says nothing about a message that is not an object', () => {
    expect(textOf('nawak')).toBeNull()
  })

  it('says nothing about a blank block, so the screen is not filled with holes', () => {
    expect(textOf({ type: 'assistant', message: { content: [{ type: 'text', text: '   ' }] } })).toBeNull()
  })
})
