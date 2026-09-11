type Handover<T> = { value: T; done: false } | { value: undefined; done: true }

export type InputChannel<T> = AsyncIterable<T> & {
  push: (message: T) => boolean
  close: () => void
  onClose: (listener: () => void) => void
  readonly open: boolean
}

export function createInputChannel<T>(): InputChannel<T> {
  const buffered: T[] = []
  const waiting: ((handover: Handover<T>) => void)[] = []
  const closing: (() => void)[] = []
  let closed = false

  return {
    get open() {
      return !closed
    },

    push: (message) => {
      if (closed) {
        return false
      }
      const waiter = waiting.shift()
      if (waiter === undefined) {
        buffered.push(message)
      } else {
        waiter({ value: message, done: false })
      }
      return true
    },

    close: () => {
      if (closed) {
        return
      }
      closed = true
      while (waiting.length > 0) {
        waiting.shift()?.({ value: undefined, done: true })
      }
      while (closing.length > 0) {
        closing.shift()?.()
      }
    },

    onClose: (listener) => {
      if (closed) {
        listener()
        return
      }
      closing.push(listener)
    },

    async *[Symbol.asyncIterator]() {
      while (true) {
        const ready = buffered.shift()
        if (ready !== undefined) {
          yield ready
          continue
        }
        if (closed) {
          return
        }
        const next = await new Promise<Handover<T>>((resolve) => waiting.push(resolve))
        if (next.done) {
          return
        }
        yield next.value
      }
    },
  }
}
