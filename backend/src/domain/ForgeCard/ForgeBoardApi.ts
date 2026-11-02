import { Hono } from 'hono'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import {
  backlogSchema,
  createForgeBoardSupport,
  identifierSchema,
  type ForgeBoardApiInput,
} from './ForgeBoardApiSupport.js'
import { mountForgeBoardStepRoutes } from './ForgeBoardStepRoutes.js'

export type { ForgeBoardApiInput }

export function createForgeBoardApi(input: ForgeBoardApiInput): Hono {
  const { board, forgeCards, stories, events } = input
  const api = new Hono()
  const { assertHand } = createForgeBoardSupport({ stories, events })

  api.onError(mapApiError)

  api.get('/api/forge-cards', (context) => {
    const project = identifierSchema.safeParse(context.req.query('project'))
    if (!project.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (stories.projects.find(project.data) === null) {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    return context.json(board.list(project.data))
  })

  api.post('/api/forge-cards/backlog', async (context) => {
    const draft = await parseBody(context, backlogSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidBacklogStory', issues: draft.error.issues }, 422)
    }
    const epic = stories.findEpic(draft.data.subjectId)
    assertHand(context, epic.id, epic.title)
    if (draft.data.workflowId !== undefined) {
      forgeCards.assertWorkflowOfProject(epic.projectId, draft.data.workflowId, epic.title)
    }
    const story = stories.writeStory({ epicId: epic.id, title: draft.data.title, body: draft.data.title })
    stories.writeTwin({ storyId: story.id, title: `Tests: ${draft.data.title}`, body: draft.data.title })
    stories.sendToBacklog(story.id)
    const card = forgeCards.attachCardToStory(story.id, draft.data.workflowId)
    return context.json(board.view(card.id), 201)
  })

  mountForgeBoardStepRoutes(api, input)

  return api
}
