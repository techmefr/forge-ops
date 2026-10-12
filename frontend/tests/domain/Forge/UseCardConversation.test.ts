import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import { useCardConversation } from '@/domain/Forge/UseCardConversation'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

vi.mock('@/technical/Api/BoardStream', () => ({
  openBoardStream: () => ({ close: () => undefined }),
}))

const STORY = { id: 60, reference: 'TODO-2', forgeCardId: 28 }

function conversation(onSettled = vi.fn()) {
  const scope = effectScope()
  const state = scope.run(() => useCardConversation(STORY, { onSettled }))!
  return { state, onSettled }
}

beforeEach(() => {
  read.mockReset()
  send.mockReset()
  read.mockResolvedValue({ items: [] })
})

describe('replying to the agent', () => {
  it('talks to the live session', async () => {
    send.mockResolvedValue({})
    const { state } = conversation()

    expect(await state.send('go on', 'talk')).toBe(true)

    expect(send).toHaveBeenCalledWith('/api/stories/60/talk', 'POST', { message: 'go on' })
  })

  it('resumes the step with the message when the session has ended', async () => {
    send.mockImplementation((path: string) =>
      path.endsWith('/talk')
        ? Promise.reject(new BoardRequestError(409, 'ConversationClosed', 'closed'))
        : Promise.resolve({}),
    )
    const { state, onSettled } = conversation()

    expect(await state.send('ignore the missing proof', 'talk')).toBe(true)

    expect(send).toHaveBeenCalledWith('/api/stories/60/discussion', 'POST', { body: 'ignore the missing proof' })
    expect(send).toHaveBeenCalledWith('/api/forge-cards/28/launch', 'POST', { feedback: 'ignore the missing proof' })
    expect(onSettled).toHaveBeenCalled()
  })

  it('reports any other failure', async () => {
    send.mockRejectedValue(new BoardRequestError(500, 'UnexpectedError', 'boom'))
    const { state } = conversation()

    expect(await state.send('hello', 'talk')).toBe(false)
    expect(state.failure.value).not.toBeNull()
  })
})
