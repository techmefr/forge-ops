import { Hono } from 'hono'
import { z } from 'zod'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError, StoryViolationError } from '../Story/StoryViolation.js'
import { readJobStates, readRoster } from '../../technical/ClaudeCode/JobStateReader.js'

const storyDraftSchema = z.object({
  epicId: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
})

const twinDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

const identifierSchema = z.coerce.number().int().positive()

export type BoardApiInput = {
  repository: StoryRepository
  claudeHome: string
}

export function createBoardApi({ repository, claudeHome }: BoardApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof StoryViolationError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.post('/api/stories', async (context) => {
    const draft = storyDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidStoryDraft', issues: draft.error.issues }, 422)
    }
    return context.json(repository.writeStory(draft.data), 201)
  })

  api.post('/api/stories/:id/twin', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = twinDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidTwinDraft', issues: draft.error.issues }, 422)
    }
    return context.json(repository.writeTwin({ storyId: storyId.data, ...draft.data }), 201)
  })

  api.post('/api/stories/:id/backlog', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.sendToBacklog(storyId.data))
  })

  api.get('/api/stories/backlog', (context) => context.json(repository.listBacklog()))

  api.get('/api/fleet', (context) =>
    context.json({
      roster: readRoster(claudeHome),
      jobs: readJobStates(claudeHome),
    }),
  )

  return api
}
