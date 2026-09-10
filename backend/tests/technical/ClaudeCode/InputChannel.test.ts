import { describe, expect, it } from 'vitest'
import { createInputChannel } from '../../../src/technical/ClaudeCode/InputChannel.js'

async function take(channel: AsyncIterable<{ text: string }>, count: number): Promise<string[]> {
  const taken: string[] = []
  for await (const message of channel) {
    taken.push(message.text)
    if (taken.length === count) {
      break
    }
  }
  return taken
}

describe('createInputChannel', () => {
  it('yields what was pushed before anyone iterated', async () => {
    const channel = createInputChannel<{ text: string }>()
    channel.push({ text: 'premier' })
    channel.push({ text: 'second' })

    expect(await take(channel, 2)).toEqual(['premier', 'second'])
  })

  it('hands a pending iteration the message pushed afterwards', async () => {
    const channel = createInputChannel<{ text: string }>()
    const taken = take(channel, 1)

    channel.push({ text: 'en vol' })

    expect(await taken).toEqual(['en vol'])
  })

  it('keeps the order of messages pushed while an iteration waits', async () => {
    const channel = createInputChannel<{ text: string }>()
    const taken = take(channel, 3)

    channel.push({ text: 'un' })
    channel.push({ text: 'deux' })
    channel.push({ text: 'trois' })

    expect(await taken).toEqual(['un', 'deux', 'trois'])
  })

  it('ends the iteration when closed', async () => {
    const channel = createInputChannel<{ text: string }>()
    const collected: string[] = []
    const drained = (async () => {
      for await (const message of channel) {
        collected.push(message.text)
      }
    })()

    channel.push({ text: 'dernier' })
    channel.close()
    await drained

    expect(collected).toEqual(['dernier'])
  })

  it('refuses a push once closed', () => {
    const channel = createInputChannel<{ text: string }>()
    channel.close()

    expect(channel.push({ text: 'trop tard' })).toBe(false)
  })

  it('accepts a push while open', () => {
    const channel = createInputChannel<{ text: string }>()

    expect(channel.push({ text: 'a temps' })).toBe(true)
  })

  it('drains what was buffered before the close', async () => {
    const channel = createInputChannel<{ text: string }>()
    channel.push({ text: 'garde moi' })
    channel.close()

    expect(await take(channel, 1)).toEqual(['garde moi'])
  })

  it('reports whether it is still open', () => {
    const channel = createInputChannel<{ text: string }>()

    expect(channel.open).toBe(true)
    channel.close()
    expect(channel.open).toBe(false)
  })
})
