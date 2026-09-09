import { describe, expect, it } from 'vitest'
import { closeOnSignals, SHUTDOWN_SIGNALS } from '../../../src/technical/Http/Shutdown.js'

type Handler = () => void

function listening() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    on: (signal: string, handler: Handler) => {
      handlers.set(signal, handler)
    },
  }
}

describe('closeOnSignals', () => {
  it('listens to every signal a terminal can send', () => {
    const { handlers, on } = listening()

    closeOnSignals({ close: () => Promise.resolve() }, { on, exit: () => undefined })

    expect([...handlers.keys()]).toEqual([...SHUTDOWN_SIGNALS])
  })

  it('closes the board when the signal arrives', async () => {
    const { handlers, on } = listening()
    let closed = 0

    closeOnSignals(
      {
        close: () => {
          closed += 1
          return Promise.resolve()
        },
      },
      { on, exit: () => undefined },
    )
    handlers.get('SIGINT')?.()
    await Promise.resolve()

    expect(closed).toBe(1)
  })

  it('leaves the process once the board is closed', async () => {
    const { handlers, on } = listening()
    const codes: number[] = []

    closeOnSignals({ close: () => Promise.resolve() }, { on, exit: (code) => codes.push(code) })
    handlers.get('SIGTERM')?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(codes).toEqual([0])
  })

  it('leaves anyway when the board refuses to close', async () => {
    const { handlers, on } = listening()
    const codes: number[] = []

    closeOnSignals(
      { close: () => Promise.reject(new Error('coince')) },
      { on, exit: (code) => codes.push(code) },
    )
    handlers.get('SIGTERM')?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(codes).toEqual([1])
  })

  it('closes once even when the signal comes twice', async () => {
    const { handlers, on } = listening()
    let closed = 0

    closeOnSignals(
      {
        close: () => {
          closed += 1
          return Promise.resolve()
        },
      },
      { on, exit: () => undefined },
    )
    handlers.get('SIGINT')?.()
    handlers.get('SIGINT')?.()
    await Promise.resolve()

    expect(closed).toBe(1)
  })
})
