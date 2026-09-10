import { createInputChannel, type InputChannel } from './InputChannel.js'

export type LiveSession<T> = {
  channel: InputChannel<T>
  adopt: (claudeSessionId: string) => void
}

export type LiveSessions<T> = {
  start: () => LiveSession<T>
  find: (claudeSessionId: string) => InputChannel<T> | null
  close: (claudeSessionId: string) => boolean
  closeAll: () => void
}

export function createLiveSessions<T>(): LiveSessions<T> {
  const channels = new Map<string, InputChannel<T>>()

  return {
    start: () => {
      const channel = createInputChannel<T>()
      return {
        channel,
        adopt: (claudeSessionId) => channels.set(claudeSessionId, channel),
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
