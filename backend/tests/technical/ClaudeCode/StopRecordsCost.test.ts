import { beforeEach, describe, expect, it, vi } from 'vitest'

const queried = vi.fn()

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (input: unknown) => queried(input),
  resolveSettings: () =>
    Promise.resolve({
      effective: {
        hooks: {
          PreToolUse: [
            { hooks: [{ type: 'command', command: 'tsx', args: ['backend/src/technical/Guardrail/DenyHook.ts'] }] },
            { hooks: [{ type: 'command', command: 'tsx', args: ['backend/src/technical/Guardrail/ScopeHook.ts'] }] },
          ],
        },
      },
    }),
}))

const { createSdkSessionRunner, createSdkSessionTalker } = await import(
  '../../../src/technical/ClaudeCode/SdkSessionRunner.js'
)
const { createLiveSessions } = await import('../../../src/technical/ClaudeCode/LiveSessions.js')
const { recordUsageFromEvent } = await import('../../../src/technical/ClaudeCode/UsageRecorder.js')
const { openDatabase } = await import('../../../src/technical/Database/Connection.js')
const { createStoryRepository } = await import('../../../src/domain/Story/StoryRepository.js')
const { createAgentSessionRepository } = await import('../../../src/domain/Agent/AgentSessionRepository.js')
import type { SdkUserTurn } from '../../../src/technical/ClaudeCode/TurnDelivery.js'
import type { BoardEvent } from '../../../src/technical/Http/EventBus.js'

type Conversation = AsyncIterable<{ type: string; session_id: string }> & {
  close: () => void
  interrupt: () => Promise<undefined>
}

function interruptibleConversation(totalCostUsd: number): { conversation: Conversation; interrupted: () => number } {
  let interruptions = 0
  let release: () => void = () => undefined
  const stopped = new Promise<void>((resolve) => {
    release = resolve
  })
  async function* run(): AsyncGenerator<{ type: string; session_id: string; total_cost_usd?: number }> {
    yield { type: 'system', session_id: 'sess-stop' }
    await stopped
    yield { type: 'result', session_id: 'sess-stop', total_cost_usd: totalCostUsd }
  }
  const walking = run()
  return {
    interrupted: () => interruptions,
    conversation: {
      [Symbol.asyncIterator]: () => walking,
      close: () => undefined,
      interrupt: () => {
        interruptions += 1
        release()
        return Promise.resolve(undefined)
      },
    },
  }
}

describe('stopping a running session', () => {
  beforeEach(() => {
    queried.mockReset()
  })

  it('ends the process and records the cost accumulated until the stop', async () => {
    const db = openDatabase(':memory:')
    const stories = createStoryRepository(db)
    const sessions = createAgentSessionRepository(db)
    const project = stories.createProject({
      slug: 'forge',
      name: 'Forge',
      repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
      integrationBranch: 'forge',
      colour: '#ff3b00',
    })
    const epic = stories.createEpic({ projectId: project.id, title: 'Stop', businessIntent: 'arreter' })
    const story = stories.writeStory({ epicId: epic.id, title: 'arreter une session en cours', body: 'corps' })
    const { conversation, interrupted } = interruptibleConversation(0.13)
    queried.mockReturnValue(conversation)
    const live = createLiveSessions<SdkUserTurn>()
    const onEvent = (event: { name: string; payload: Record<string, unknown> }): void => {
      recordUsageFromEvent(sessions, event as BoardEvent)
    }
    const runner = createSdkSessionRunner({ cwdFor: () => '/tmp', live, onEvent })
    const talker = createSdkSessionTalker({ live, onEvent })
    const launched = await runner.launch({
      storyId: story.id,
      reference: story.reference,
      phase: 'spec',
      agentName: 'architecte',
      prompt: 'travaille longtemps',
    })
    sessions.registerSession({
      storyId: story.id,
      claudeSessionId: launched.claudeSessionId,
      phase: 'spec',
      agentName: 'architecte',
      claudeCodeVersion: '2.1.224',
    })

    talker.hangUp(launched.claudeSessionId)
    sessions.closeSession(launched.claudeSessionId, { exitCode: null, signal: 'SIGTERM' })

    expect(interrupted()).toBe(1)
    await vi.waitFor(() => expect(sessions.sumUsage(story.id).costUsd).toBeCloseTo(0.13, 6))
    expect(sessions.findByClaudeSessionId(launched.claudeSessionId)?.lifecycle).toBe('interrupted')
    expect(live.count()).toBe(0)
  })
})
