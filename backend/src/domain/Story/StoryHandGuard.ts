import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { mayAdministerProject } from '../Project/ProjectAuthority.js'
import type { StoryRepository } from './StoryRepository.js'
import { mayActOnEpic } from './StoryHand.js'

export type StoryHandGuardInput = {
  stories: StoryRepository
  isSuperAdmin: (login: string) => boolean
  isDirector: (login: string) => boolean
}

const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS']

const SUBJECT_PATH = /^\/api\/(stories|epics)\/(\d+)(?:\/([^/]+))?/

const assignmentSchema = z.object({ login: z.string() })

export function createStoryHandGuard({ stories, isSuperAdmin, isDirector }: StoryHandGuardInput): MiddlewareHandler {
  return async (context, next) => {
    const found = SUBJECT_PATH.exec(context.req.path)
    if (found === null || SAFE_METHODS.includes(context.req.method)) {
      return next()
    }
    const kind = found[1]
    const id = Number(found[2])
    const action = found[3] ?? ''
    if (kind === 'epics' && action === 'claim') {
      return next()
    }

    let epicId: number
    let reference = `epic ${id}`
    try {
      if (kind === 'stories') {
        const story = stories.findStory(id)
        epicId = story.epicId
        reference = story.reference
      } else {
        epicId = id
      }
      const assignee = stories.assigneeOf(epicId)
      const login = operatorOf(context)
      const adminLogin = stories.projects.find(stories.findEpic(epicId).projectId)?.adminLogin ?? null
      const mayAdminister =
        mayAdministerProject({ login, adminLogin, isSuperAdmin, isDirector }) || isDirector(login)
      if (!mayActOnEpic({ login, assignee, mayAdminister })) {
        return context.json(
          {
            error: 'StoryNotYoursError',
            message: `The epic of ${reference} belongs to ${assignee ?? ''}, nobody else touches it`,
          },
          409,
        )
      }
      if (kind === 'epics' && action === 'assignee' && assignee === null && !mayAdminister) {
        const body = assignmentSchema.safeParse(await context.req.json().catch(() => null))
        if (body.success && body.data.login !== login) {
          return context.json({ error: 'AssignmentNeedsAnAdmin' }, 403)
        }
      }
      context.set('handOverride', mayAdminister)
    } catch {
      return next()
    }
    return next()
  }
}
