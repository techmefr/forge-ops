import type { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { STALE_AFTER_SECONDS } from '../Agent/Heartbeat.js'
import { isWriteTool } from '../Agent/ToolName.js'
import { isConfinedPath, relativeToDirectory } from '../File/ConfinedPath.js'
import { describeZone } from '../Zone/ZoneDigest.js'
import type { BoardApiInput } from './BoardApi.js'

const hookPayloadSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().min(1),
  cwd: z.string().nullish(),
  tool_name: z.string().nullish(),
  tool_input: z.object({ file_path: z.string().nullish() }).passthrough().nullish(),
})

export function mountSessionRoutes(
  api: Hono,
  { repository, agentSessions, zones }: Pick<BoardApiInput, 'repository' | 'agentSessions' | 'zones'>,
): void {
  api.post('/api/hooks', async (context) => {
    const payload = await parseBody(context, hookPayloadSchema)
    if (!payload.success) {
      return context.json({ error: 'InvalidHookPayload', issues: payload.error.issues }, 422)
    }

    const hook = payload.data
    if (agentSessions.findByClaudeSessionId(hook.session_id) !== null) {
      agentSessions.recordHeartbeat(hook.session_id)
    }
    const reported = hook.tool_input?.file_path
    const path = typeof reported === 'string' ? relativeToDirectory(reported, hook.cwd) : reported
    const touchesAFile =
      hook.hook_event_name === 'PostToolUse' &&
      hook.tool_name !== null &&
      hook.tool_name !== undefined &&
      isWriteTool(hook.tool_name) &&
      path !== null &&
      path !== undefined
    if (!touchesAFile) {
      return context.json({ recorded: false }, 202)
    }

    if (!isConfinedPath(path)) {
      return context.json({ error: 'UnconfinedFilePath', recorded: false }, 422)
    }

    const session = agentSessions.findByClaudeSessionId(hook.session_id)
    if (session === null) {
      return context.json({ recorded: false }, 202)
    }

    agentSessions.recordFileTouch({ claudeSessionId: hook.session_id, path })
    const zone = zones.zoneOfPath(repository.projectOfStory(session.storyId), path)
    if (zone !== null) {
      zones.summariseZone(
        zone.projectId,
        zone.pathPrefix,
        describeZone(zones.overviewOfZone(zone.projectId, zone.pathPrefix)),
      )
    }
    return context.json({ recorded: true }, 202)
  })

  api.get('/api/sessions/stale', (context) =>
    context.json({
      staleAfterSeconds: STALE_AFTER_SECONDS,
      sessions: agentSessions.listStaleSessions(),
    }),
  )

  api.get('/api/files/conflicts', (context) => context.json(agentSessions.listConflictingPaths()))
}
