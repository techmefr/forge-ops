import { Hono } from 'hono'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { mountStoryAuthoringRoutes } from './StoryAuthoringRoutes.js'
import { mountStoryClosureRoutes } from './StoryClosureRoutes.js'
import { mountStoryFlowRoutes } from './StoryFlowRoutes.js'
import { mountStoryReadRoutes } from './StoryReadRoutes.js'
import type { StoryApiInput } from './StoryRouteSupport.js'

export type { StoryApiInput } from './StoryRouteSupport.js'

export function createStoryApi(input: StoryApiInput): Hono {
  const api = new Hono()
  api.onError(mapApiError)
  mountStoryAuthoringRoutes(api, input)
  mountStoryFlowRoutes(api, input)
  mountStoryClosureRoutes(api, input)
  mountStoryReadRoutes(api, input)
  return api
}
