import { ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import type { Story, Ticket } from '@/domain/Board/BoardModel'

export type StoryDraft = {
  epicId: number
  title: string
  body: string
}

export type TwinDraft = {
  title: string
  body: string
}

export type CriterionDraft = {
  reference: string
  statement: string
  persona: string | null
  expectsRefusal: boolean
}

export function useTicket() {
  const openStoryId = ref<number | null>(null)

  const ticket = useResource<Ticket | null>(async () => {
    const storyId = openStoryId.value
    return storyId === null ? null : board.read<Ticket>(`/api/stories/${storyId}/ticket`)
  })

  async function open(storyId: number): Promise<void> {
    openStoryId.value = storyId
    await ticket.reload()
  }

  async function write(draft: StoryDraft): Promise<Story> {
    const story = await board.send<Story>('/api/stories', 'POST', draft)
    await open(story.id)
    return story
  }

  async function writeTwin(storyId: number, draft: TwinDraft): Promise<void> {
    await board.send(`/api/stories/${storyId}/twin`, 'POST', draft)
    await open(storyId)
  }

  async function declareCriterion(storyId: number, draft: CriterionDraft): Promise<void> {
    await board.send(`/api/stories/${storyId}/criteria`, 'POST', draft)
    await open(storyId)
  }

  async function sendToBacklog(storyId: number): Promise<void> {
    await board.send(`/api/stories/${storyId}/backlog`, 'POST')
    await open(storyId)
  }

  async function dispatch(storyId: number, phase: string): Promise<void> {
    await board.send(`/api/stories/${storyId}/dispatch`, 'POST', { phase })
  }

  return { openStoryId, ticket, open, write, writeTwin, declareCriterion, sendToBacklog, dispatch }
}
