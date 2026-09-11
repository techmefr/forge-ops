import { createInputChannel, type InputChannel } from './InputChannel.js'

export class SessionAlreadyAdoptedError extends Error {
  readonly claudeSessionId: string

  constructor(claudeSessionId: string) {
    super(`la session ${claudeSessionId} tient deja un canal ouvert`)
    this.name = 'SessionAlreadyAdoptedError'
    this.claudeSessionId = claudeSessionId
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
  readonly size: number
}

export function createLiveSessions<T>(): LiveSessions<T> {
  const channels = new Map<string, InputChannel<T>>()

  function sweep(): void {
    for (const [claudeSessionId, channel] of channels) {
      if (!channel.open) {
        channels.delete(claudeSessionId)
      }
    }
  }

  return {
    get size() {
      sweep()
      return channels.size
    },

    start: () => {
      const channel = createInputChannel<T>()
      return {
        channel,
        adopt: (claudeSessionId) => {
          sweep()
          if (channels.get(claudeSessionId)?.open === true) {
            throw new SessionAlreadyAdoptedError(claudeSessionId)
          }
          channels.set(claudeSessionId, channel)
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
      for (const channel of channels.values()) {
        channel.close()
      }
      channels.clear()
    },
  }
}
