import type { AutopilotRepository } from '../domain/Autopilot/AutopilotRepository.js'
import type { MessageRepository } from '../domain/Conversation/MessageRepository.js'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import type { WorktreeRepository } from '../domain/Worktree/WorktreeRepository.js'
import { createStoryPublisher } from '../technical/Git/StoryPublication.js'
import type { GuardrailSeal } from '../technical/Guardrail/GuardrailSeal.js'
import type { EventBus } from '../technical/Http/EventBus.js'

type PublishingInput = {
  stories: StoryRepository
  autopilotSettings: AutopilotRepository
  worktrees: WorktreeRepository
  events: EventBus
}

export function createStoryPublishing({ stories, autopilotSettings, worktrees, events }: PublishingInput) {
  const storyPublisher = createStoryPublisher()
  return (storyId: number) => {
    const projectId = stories.projectOfStory(storyId)
    const settings = autopilotSettings.settingsOf(projectId)
    const worktree = worktrees.findForStory(storyId)
    if (!settings.enabled || !settings.autoPublish || worktree === null) {
      return null
    }
    const story = stories.findStory(storyId)
    const report = storyPublisher.publish({
      worktreePath: worktree.path,
      branch: worktree.branch,
      baseBranch: stories.listProjects().find((project) => project.id === projectId)?.integrationBranch ?? 'main',
      title: story.title,
      body: `${story.reference}\n\n${story.body}`,
      autoMerge: settings.autoMerge,
    })
    events.publish({ name: 'story.published', payload: { storyId, ...report } })
    return report
  }
}

export function integrityOfStory(guardrailSeal: GuardrailSeal, cwdForStory: (storyId: number) => string) {
  return (storyId: number): string | null => {
    const cwd = cwdForStory(storyId)
    const changes = guardrailSeal.changesSince(cwd)
    if (changes.length > 0) {
      guardrailSeal.markTampered(cwd, changes)
    }
    return guardrailSeal.tamperedReason(cwd)
  }
}

export function lastAgentMessageOf(messages: MessageRepository) {
  return (storyId: number): string | null =>
    messages
      .listOfStory(storyId)
      .filter((message) => message.voice === 'agent')
      .at(-1)?.body ?? null
}
