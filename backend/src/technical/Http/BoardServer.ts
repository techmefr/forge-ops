import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../Database/Connection.js'
import { createStoryRepository } from '../../domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../domain/Checkpoint/CheckpointRepository.js'
import { createZoneRepository } from '../../domain/Zone/ZoneRepository.js'
import { createCriterionRepository } from '../../domain/Criterion/CriterionRepository.js'
import { createDispatcher } from '../../domain/Dispatch/Dispatcher.js'
import { createBoardApi } from '../../domain/Board/BoardApi.js'
import { createEventBus } from './EventBus.js'
import { createBoardPage } from './BoardPage.js'
import { createSdkSessionRunner } from '../ClaudeCode/SdkSessionRunner.js'
import { createTokenGuard } from '../Auth/TokenGuard.js'
import { deriveHookToken, resolveBoardToken } from '../Auth/BoardToken.js'

const DEFAULT_SESSION_CAP = 3

type ServerType = ReturnType<typeof serve>

const LOOPBACK = '127.0.0.1'

export type BoardServerInput = {
  port: number
  dbPath: string
  claudeHome: string
  host: string
  tokenPath: string
  distDir: string
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
    host: process.env.FORGE_HOST ?? LOOPBACK,
    tokenPath: process.env.FORGE_TOKEN_PATH ?? '.forge-token',
    distDir: process.env.FORGE_DIST_DIR ?? join('dist', 'web'),
  }
}

export function startBoardServer({
  port,
  dbPath,
  claudeHome,
  host,
  tokenPath,
  distDir,
}: BoardServerInput): Promise<BoardServer> {
  const db = openDatabase(dbPath)
  const token = resolveBoardToken(tokenPath)
  const events = createEventBus()
  const stories = createStoryRepository(db)
  const sessions = createAgentSessionRepository(db)
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db),
    sessions,
    runner: createSdkSessionRunner({
      cwd: process.cwd(),
      onEvent: (event) => events.publish(event),
    }),
    concurrencyCap: Number(process.env.FORGE_SESSION_CAP ?? DEFAULT_SESSION_CAP),
    claudeCodeVersion: process.env.CLAUDE_CODE_VERSION ?? 'unknown',
  })
  const api = createBoardApi({
    zones: createZoneRepository(db),
    repository: stories,
    agentSessions: sessions,
    checkpoints: createCheckpointRepository(db),
    criteria: createCriterionRepository(db),
    events,
    dispatcher,
    claudeHome,
  })

  const guarded = new Hono()
  guarded.use(
    '/api/*',
    createTokenGuard({
      token,
      allowedOrigins: [`http://${host}:${port}`, 'http://localhost:8832', 'http://127.0.0.1:8832'],
      hookToken: deriveHookToken(token),
    }),
  )
  guarded.route('/', api)
  guarded.route('/', createBoardPage({ token, distDir }))

  return new Promise((resolve) => {
    const server = serve({ fetch: guarded.fetch, port, hostname: host }, (address) => {
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
