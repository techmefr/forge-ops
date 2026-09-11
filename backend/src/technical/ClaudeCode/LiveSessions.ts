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
    super(`le plafond de ${cap} sessions vivantes est atteint`)
    this.name = 'LiveSessionCapReachedError'
  }
}

export type LiveSession<T> = {
  channel: InputChannel<T>
  adopt: (claudeSessionId: string) => void
}

export type LiveSessions<T> = {
  start: () => LiveSession<T>
  find: (claudeSessionId: string) => InputChannel<T> | null
  close: (claudeSessionId: string) => boolean
  closeAll: () => void
  count: () => number
}

export type LiveSessionsInput = {
  cap?: number
}

export function createLiveSessions<T>({ cap = DEFAULT_LIVE_SESSION_CAP }: LiveSessionsInput = {}): LiveSessions<T> {
  const channels = new Map<string, InputChannel<T>>()

  function forget(claudeSessionId: string, channel: InputChannel<T>): void {
    if (channels.get(claudeSessionId) === channel) {
      channels.delete(claudeSessionId)
    }
  }

  return {
    start: () => {
      const channel = createInputChannel<T>()
      return {
        channel,
        adopt: (claudeSessionId) => {
          const held = channels.get(claudeSessionId)
          if (held !== undefined && held.open) {
            throw new SessionAlreadyLiveError(claudeSessionId)
          }
          if (held === undefined && channels.size >= cap) {
            throw new LiveSessionCapReachedError(cap)
          }
          channels.set(claudeSessionId, channel)
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

    closeAll: () => {
      for (const channel of [...channels.values()]) {
        channel.close()
      }
      channels.clear()
    },

    count: () => channels.size,
  }
}
