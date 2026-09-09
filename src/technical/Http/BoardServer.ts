import { serve } from '@hono/node-server'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../Database/Connection.js'
import { createStoryRepository } from '../../domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../domain/Checkpoint/CheckpointRepository.js'
import { createZoneRepository } from '../../domain/Zone/ZoneRepository.js'
import { createCriterionRepository } from '../../domain/Criterion/CriterionRepository.js'
import { createBoardApi } from '../../domain/Board/BoardApi.js'

type ServerType = ReturnType<typeof serve>

export type BoardServerInput = {
  port: number
  dbPath: string
  claudeHome: string
}

export type BoardServer = {
  server: ServerType
  port: number
  close: () => Promise<void>
}

export function defaultBoardServerInput(): BoardServerInput {
  return {
    port: Number(process.env.FORGE_PORT ?? 8830),
    dbPath: process.env.FORGE_DB_PATH ?? 'forge.db',
    claudeHome: process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'),
  }
}

export function startBoardServer({ port, dbPath, claudeHome }: BoardServerInput): Promise<BoardServer> {
  const db = openDatabase(dbPath)
  const api = createBoardApi({
    zones: createZoneRepository(db),
    repository: createStoryRepository(db),
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db),
    criteria: createCriterionRepository(db),
    claudeHome,
  })

  return new Promise((resolve) => {
    const server = serve({ fetch: api.fetch, port }, (address) => {
      resolve({
        server,
        port: address.port,
        close: () =>
          new Promise((closed) => {
            server.close(() => {
              db.close()
              closed()
            })
          }),
      })
    })
  })
}
