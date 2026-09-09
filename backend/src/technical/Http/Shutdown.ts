export const SHUTDOWN_SIGNALS: readonly string[] = ['SIGINT', 'SIGTERM']

export type Closable = {
  close: () => Promise<void>
}

export type ShutdownHost = {
  on: (signal: string, handler: () => void) => void
  exit: (code: number) => void
}

const HOST: ShutdownHost = {
  on: (signal, handler) => {
    process.on(signal, handler)
  },
  exit: (code) => {
    process.exit(code)
  },
}

export function closeOnSignals(board: Closable, host: ShutdownHost = HOST): void {
  let closing = false
  for (const signal of SHUTDOWN_SIGNALS) {
    host.on(signal, () => {
      if (closing) {
        return
      }
      closing = true
      void board
        .close()
        .then(() => host.exit(0))
        .catch(() => host.exit(1))
    })
  }
}
