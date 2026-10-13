import type Database from 'better-sqlite3'
import type { ThreadToolLog } from '../../../../contract/ConversationContract.js'
import type { BoardEvent } from '../../technical/Http/EventBus.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'

export type ToolLogRepository = {
  start: (storyId: number, claudeSessionId: string, toolUseId: string, name: string, input: string) => void
  finish: (claudeSessionId: string, toolUseId: string, output: string, failed: boolean) => void
  listOfStory: (storyId: number) => readonly ThreadToolLog[]
}

type ToolLogRow = {
  claude_session_id: string
  tool_use_id: string
  name: string
  input: string
  output: string
  failed: number
  written_at: string
}

export function createToolLogRepository(db: Database.Database): ToolLogRepository {
  const insert = db.prepare<[number, string, string, string, string]>(
    'INSERT OR IGNORE INTO tool_log (story_id, claude_session_id, tool_use_id, name, input) VALUES (?, ?, ?, ?, ?)',
  )
  const update = db.prepare<[string, number, string, string]>(
    'UPDATE tool_log SET output = ?, failed = ? WHERE claude_session_id = ? AND tool_use_id = ?',
  )
  const select = db.prepare<[number], ToolLogRow>(
    'SELECT claude_session_id, tool_use_id, name, input, output, failed, written_at FROM tool_log WHERE story_id = ? ORDER BY id',
  )

  return {
    start: (storyId, claudeSessionId, toolUseId, name, input) => {
      insert.run(storyId, claudeSessionId, toolUseId, name, input)
    },
    finish: (claudeSessionId, toolUseId, output, failed) => {
      update.run(output, failed ? 1 : 0, claudeSessionId, toolUseId)
    },
    listOfStory: (storyId) =>
      select.all(storyId).map((row) => ({
        id: row.tool_use_id,
        claudeSessionId: row.claude_session_id,
        at: row.written_at,
        name: row.name,
        input: row.input,
        output: row.output,
        failed: row.failed === 1,
      })),
  }
}

export type ToolLogRecorderInput = {
  sessions: Pick<AgentSessionRepository, 'findByClaudeSessionId'>
  toolLogs: Pick<ToolLogRepository, 'start' | 'finish'>
}

export function recordToolLogFromEvent({ sessions, toolLogs }: ToolLogRecorderInput, event: BoardEvent): void {
  if (event.name !== 'session.assistant' && event.name !== 'session.user') {
    return
  }
  const { claudeSessionId, tools } = event.payload
  if (typeof claudeSessionId !== 'string' || claudeSessionId === '' || !Array.isArray(tools)) {
    return
  }
  const session = sessions.findByClaudeSessionId(claudeSessionId)
  if (session === null) {
    return
  }
  for (const entry of tools) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const tool = entry as Record<string, unknown>
    if (typeof tool.id !== 'string') {
      continue
    }
    if (tool.outcome === 'started') {
      toolLogs.start(session.storyId, claudeSessionId, tool.id, typeof tool.name === 'string' ? tool.name : '', typeof tool.input === 'string' ? tool.input : '')
    } else if (tool.outcome === 'ok' || tool.outcome === 'failed') {
      toolLogs.finish(claudeSessionId, tool.id, typeof tool.output === 'string' ? tool.output : '', tool.outcome === 'failed')
    }
  }
}
