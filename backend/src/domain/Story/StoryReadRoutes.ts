import type { Hono } from 'hono'
import type { Ticket } from '../../../../contract/BoardContract.js'
import { buildStoryReport } from '../Board/StoryReport.js'
import { scoreCompleteness } from './Completeness.js'
import { identifierSchema, type StoryApiInput } from './StoryRouteSupport.js'

export function mountStoryReadRoutes(
  api: Hono,
  { repository, checkpoints, criteria, agentSessions }: Pick<StoryApiInput, 'repository' | 'checkpoints' | 'criteria' | 'agentSessions'>,
): void {
  api.get('/api/stories/:id/blockers', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    repository.findStory(storyId.data)
    return context.json({ blockers: repository.listBlockers(storyId.data) })
  })

  api.get('/api/stories/:id/ticket', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const asked = repository.findStory(storyId.data)
    const functional =
      asked.twinOfStoryId === null ? asked : repository.findStory(asked.twinOfStoryId)
    const ticket: Ticket = {
      functional,
      tests: repository.findTwin(functional.id),
      criteria: criteria.listCriteria(functional.id),
      dod: checkpoints.definitionOfDone(functional.id),
      cascade: checkpoints.reviewCascade(functional.id),
      blockers: repository.listBlockers(functional.id),
      stepBacks: repository.listStepBacks(functional.id),
      completeness: scoreCompleteness({
        title: functional.title,
        body: functional.body,
        criteria: criteria.listCriteria(functional.id).map((criterion) => criterion.reference),
        hasTwin: repository.findTwin(functional.id) !== null,
      }),
    }
    return context.json(ticket)
  })

  api.get('/api/stories/:id/report', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    repository.findStory(storyId.data)
    return context.json(
      buildStoryReport({
        storyId: storyId.data,
        stories: repository,
        checkpoints,
        criteria,
        sessions: agentSessions,
      }),
    )
  })
}
