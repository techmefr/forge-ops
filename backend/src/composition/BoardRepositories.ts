import { createAgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createAutopilotRepository } from '../domain/Autopilot/AutopilotRepository.js'
import type { openDatabase } from '../technical/Database/Connection.js'
import { createBatchRepository } from '../domain/Delivery/BatchRepository.js'
import { createBudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { createMessageRepository } from '../domain/Conversation/MessageRepository.js'
import { createToolLogRepository } from '../domain/Conversation/ToolLogRepository.js'
import { createDiscussionRepository } from '../domain/Discussion/DiscussionRepository.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createForgeCardRepository } from '../domain/ForgeCard/ForgeCardRepository.js'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createOrganisationRepository } from '../domain/Organisation/OrganisationRepository.js'
import { createOutboxRepository } from '../domain/Boundary/OutboxRepository.js'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createTemplateRepository } from '../domain/Template/TemplateRepository.js'
import { createProjectWorkflowRepository } from '../domain/Workflow/ProjectWorkflowRepository.js'
import { createWorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import { createWorkflowRepository } from '../domain/Workflow/WorkflowRepository.js'

const PURGE_EVERY_MS = 24 * 60 * 60 * 1000

export type BoardRepositories = ReturnType<typeof createBoardRepositories>

function releaseOrphanSessions(sessions: ReturnType<typeof createAgentSessionRepository>): void {
  const abandoned = sessions.abandonRunningSessions()
  if (abandoned > 0) {
    console.log(`${abandoned} session${abandoned > 1 ? 's' : ''} orpheline${abandoned > 1 ? 's' : ''} liberee${abandoned > 1 ? 's' : ''}`)
  }
}

export function createBoardRepositories(db: ReturnType<typeof openDatabase>,allowedCheckoutRoots: readonly string[]) {
  const forgeCards = createForgeCardRepository(db)
  const stories = createStoryRepository(db, {
    checkoutRoots: allowedCheckoutRoots,
    onBacklog: (story) => forgeCards.attachCardToStory(story.id),
  })
  stories.epics.purgeExpired()
  setInterval(() => stories.epics.purgeExpired(), PURGE_EVERY_MS).unref()
  const sessions = createAgentSessionRepository(db)
  releaseOrphanSessions(sessions)
  return {
    forgeCards,
    stories,
    sessions,
    foremerge: createForemergeRepository(db, { stories }),
    budget: createBudgetRepository(db),
    workflow: createWorkflowRepository(db),
    workflowColumns: createWorkflowColumnRepository(db),
    projectWorkflows: createProjectWorkflowRepository(db),
    messages: createMessageRepository(db),
    toolLogs: createToolLogRepository(db),
    autopilotSettings: createAutopilotRepository(db),
    templates: createTemplateRepository(db),
    outbox: createOutboxRepository(db),
    organisations: createOrganisationRepository(db),
    discussion: createDiscussionRepository(db, { stories }),
    batches: createBatchRepository(db),
    identities: createIdentityRepository(db),
  }
}
