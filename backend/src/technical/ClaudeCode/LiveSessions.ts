import { createInputChannel, type InputChannel } from './InputChannel.js'

export const DEFAULT_LIVE_SESSION_CAP = 64

export class SessionAlreadyLiveError extends Error {
  constructor(claudeSessionId: string) {
    super(`la session ${claudeSessionId} est deja tenue par un autre canal`)
    this.name = 'SessionAlreadyLiveError'
  }
}

export class LiveSessionCapReachedError extends Error {
  constructor(cap: number) {
    super(`the cap of ${cap} live sessions is reached`)
    this.name = 'LiveSessionCapReachedError'
  }
}

export type LiveSession<T> = {
  channel: InputChannel<T>
  adopt: (claudeSessionId: string) => void
  onTerminate: (stop: () => void) => void
}

export type LiveSessions<T> = {
  start: () => LiveSession<T>
  find: (claudeSessionId: string) => InputChannel<T> | null
  close: (claudeSessionId: string) => boolean
  terminate: (claudeSessionId: string) => boolean
  closeAll: () => void
  count: () => number
}

export type LiveSessionsInput = {
  cap?: number
}

export function createLiveSessions<T>({ cap = DEFAULT_LIVE_SESSION_CAP }: LiveSessionsInput = {}): LiveSessions<T> {
  const channels = new Map<string, InputChannel<T>>()
  const stoppers = new Map<string, () => void>()

  function forget(claudeSessionId: string, channel: InputChannel<T>): void {
    if (channels.get(claudeSessionId) === channel) {
      channels.delete(claudeSessionId)
      stoppers.delete(claudeSessionId)
    }
  }

  return {
    start: () => {
      const channel = createInputChannel<T>()
      let stop: () => void = () => undefined
      return {
        channel,
        onTerminate: (handler) => {
          stop = handler
        },
        adopt: (claudeSessionId) => {
          const held = channels.get(claudeSessionId)
          if (held !== undefined && held.open) {
            throw new SessionAlreadyLiveError(claudeSessionId)
          }
          if (held === undefined && channels.size >= cap) {
            throw new LiveSessionCapReachedError(cap)
          }
          channels.set(claudeSessionId, channel)
          stoppers.set(claudeSessionId, () => stop())
          channel.onClose(() => forget(claudeSessionId, channel))
        },
      }
    },

    find: (claudeSessionId) => {
      const channel = channels.get(claudeSessionId)
      if (channel === undefined) {
        return null
      }
      if (!channel.open) {
        channels.delete(claudeSessionId)
        return null
      }
      return channel
    },

    close: (claudeSessionId) => {
      const channel = channels.get(claudeSessionId)
      if (channel === undefined) {
        return false
      }
      channel.close()
      channels.delete(claudeSessionId)
      return true
    },

    terminate: (claudeSessionId) => {
      const channel = channels.get(claudeSessionId)
      const stop = stoppers.get(claudeSessionId)
      if (channel === undefined) {
        return false
      }
      channel.close()
      channels.delete(claudeSessionId)
      stoppers.delete(claudeSessionId)
      stop?.()
      return true
    },

    closeAll: () => {
      for (const claudeSessionId of [...channels.keys()]) {
        const stop = stoppers.get(claudeSessionId)
        channels.get(claudeSessionId)?.close()
        stop?.()
      }
      channels.clear()
      stoppers.clear()
    },

    count: () => channels.size,
  }
}
