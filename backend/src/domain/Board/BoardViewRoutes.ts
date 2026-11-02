import type { Context, Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { readJobStates, readRoster } from '../../technical/ClaudeCode/JobStateReader.js'
import { reapStaleSessions } from '../Agent/Heartbeat.js'
import { sessionContextOf } from '../Agent/SessionContext.js'
import { PHASE_CONTRACTS } from '../Dispatch/Dispatch.js'
import type { BoardApiInput } from './BoardApi.js'
import { attentionOf, daysLeft, nextMilestone } from './CardAttention.js'

type ViewRoutesInput = Pick<BoardApiInput, 'repository' | 'agentSessions' | 'events' | 'claudeHome'> &
  Required<Pick<BoardApiInput, 'openHolds' | 'today'>> & { mayReadFleet: (context: Context) => boolean }

export function mountBoardViewRoutes(
  api: Hono,
  { repository, agentSessions, events, claudeHome, openHolds, today, mayReadFleet }: ViewRoutesInput,
): void {
  api.get('/api/events', (context) =>
    streamSSE(context, async (stream) => {
      const frames: Promise<void>[] = []
      const unsubscribe = events.subscribe((event) => {
        frames.push(stream.writeSSE({ event: event.name, data: JSON.stringify(event.payload) }))
      })
      stream.onAbort(unsubscribe)
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          unsubscribe()
          resolve()
        })
      })
      await Promise.allSettled(frames)
    }),
  )

  api.get('/api/board/kanban', (context) => {
    reapStaleSessions({ sessions: agentSessions, stories: repository })
    return context.json(
      repository.listKanban().map((story) => ({
        ...story,
        usage: agentSessions.sumUsage(story.id),
        blockers: repository.listBlockers(story.id),
        context: sessionContextOf(agentSessions.latestSessionOf(story.id)),
        activity: agentSessions.listRecentActivity(story.id),
      })),
    )
  })

  api.get('/api/board/projects', (context) => {
    const held = new Set(openHolds().map((hold) => hold.storyId))
    const context_ = new Map(repository.listCardContexts().map((card) => [card.storyId, card]))
    const day = today()
    return context.json(
      repository.listKanban().map((story) => {
        const card = context_.get(story.id) ?? null
        const blockers = repository.listBlockers(story.id)
        const milestone = nextMilestone(card?.milestones ?? [], day)
        return {
          ...story,
          usage: agentSessions.sumUsage(story.id),
          blockers,
          context: sessionContextOf(agentSessions.latestSessionOf(story.id)),
          activity: agentSessions.listRecentActivity(story.id),
          projectSlug: card?.projectSlug ?? '',
          projectColour: card?.projectColour ?? 'line',
          epicTitle: card?.epicTitle ?? '',
          holder: card?.holder ?? null,
          milestone,
          daysLeft: daysLeft(milestone, day),
          attention: attentionOf({
            story,
            blockers,
            held: held.has(story.id),
            milestone,
            today: day,
          }),
        }
      }),
    )
  })

  api.get('/api/board/phases', (context) => context.json(PHASE_CONTRACTS))

  api.get('/api/fleet', (context) => {
    if (!mayReadFleet(context)) {
      return context.json({ error: 'FleetNeedsAnAdmin' }, 403)
    }
    return context.json({
      roster: readRoster(claudeHome),
      jobs: readJobStates(claudeHome),
    })
  })
}
