import type Database from 'better-sqlite3'
import type { StoryState } from '../Story/Story.js'
import type { FileTouch } from './FileMark.js'

type TouchRow = {
  path: string
  story_reference: string
  story_state: StoryState
  agent_name: string | null
}

export type FileRepository = {
  touchesOfProject: (projectId: number) => Map<string, readonly FileTouch[]>
}

export function createFileRepository(db: Database.Database): FileRepository {
  const selectTouches = db.prepare<[number], TouchRow>(
    `SELECT DISTINCT file_touch.path AS path,
            story.reference AS story_reference,
            story.state AS story_state,
            agent_session.agent_name AS agent_name
       FROM file_touch
       JOIN story ON story.id = file_touch.story_id
       JOIN epic ON epic.id = story.epic_id
       LEFT JOIN agent_session ON agent_session.id = file_touch.agent_session_id
      WHERE epic.project_id = ?
      ORDER BY file_touch.path, story.reference`,
  )

  return {
    touchesOfProject: (projectId) => {
      const found = new Map<string, FileTouch[]>()
      for (const row of selectTouches.all(projectId)) {
        const touches = found.get(row.path) ?? []
        touches.push({
          storyReference: row.story_reference,
          storyState: row.story_state,
          agentName: row.agent_name,
        })
        found.set(row.path, touches)
      }
      return found
    },
  }
}
