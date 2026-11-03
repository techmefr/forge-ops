import { BACKLOG_STEP_KEY } from '../../../../contract/ForgeCardContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import { handlingOf, isLaunchRefusal, messageOf } from './AutopilotHandling.js'
import type { AutopilotCardState } from './AutopilotCardState.js'
import type { AutopilotConductorInput } from './AutopilotInput.js'

function abortsLaunch(error: unknown, cardId: LaunchableCard['id'], patch: AutopilotCardState['patch']): boolean {
  if (isLaunchRefusal(error)) {
    return false
  }
  if (handlingOf(error) !== 'red') {
    return true
  }
  patch(cardId, { state: 'red', reason: messageOf(error), pending: null })
  return false
}

type LaunchableCard = ReturnType<AutopilotConductorInput['board']['list']>[number]

function isIdleLaunchable(
  card: LaunchableCard,
  step: WorkflowColumn | undefined,
  budgetBlocks: () => boolean,
  heldOf: (cardId: LaunchableCard['id']) => { state: unknown; pending: unknown },
): boolean {
  const resumable = card.status === 'budget_exhausted' ? !budgetBlocks() : card.status === 'idle' && step?.autoStart === true
  return (
    resumable &&
    step !== undefined &&
    step.provider !== 'human' &&
    heldOf(card.id).state === null &&
    heldOf(card.id).pending === null
  )
}

export type AutopilotLauncher = ReturnType<typeof createAutopilotLauncher>

function createLaunchPolicy({
  autopilot,
  stories,
  columns,
  criteria,
  budget,
}: Pick<AutopilotConductorInput, 'autopilot' | 'stories' | 'columns' | 'criteria' | 'budget'>) {
  function lacksCriteria(storyId: number): boolean {
    return stories.findStory(storyId).kind === 'functional' && criteria.listCriteria(storyId).length === 0
  }

  function budgetBlocks(): boolean {
    return budget.decideConduct().conduct === 'stop'
  }

  function backlogEntryOf(projectId: number, workflowId?: number): WorkflowColumn | null {
    const project = stories.listProjects().find((candidate) => candidate.id === projectId)
    const settings = autopilot.settingsOf(projectId)
    const first = columns.list(projectId, workflowId)[0]
    const hasCheckout = project?.checkoutPath !== null && project?.checkoutPath !== undefined && project.checkoutPath !== ''
    if (!settings.enabled || !settings.autoLaunch || !hasCheckout) {
      return null
    }
    return first === undefined || first.provider === 'human' || !first.autoStart ? null : first
  }

  return { lacksCriteria, budgetBlocks, backlogEntryOf }
}

export function createAutopilotLauncher(
  input: Pick<
    AutopilotConductorInput,
    'autopilot' | 'board' | 'stories' | 'columns' | 'criteria' | 'budget' | 'mover'
  >,
  { announce, patch }: Pick<AutopilotCardState, 'announce' | 'patch'>,
) {
  const { autopilot, board, stories, columns, mover } = input
  const policy = createLaunchPolicy(input)
  const { lacksCriteria, budgetBlocks, backlogEntryOf } = policy

  async function launchBacklog(): Promise<void> {
    for (const project of stories.listProjects()) {
      if (backlogEntryOf(project.id) === null && !board.list(project.id).some((card) => backlogEntryOf(project.id, card.workflowId) !== null)) {
        continue
      }
      const waiting = board
        .list(project.id)
        .filter((card) => card.stepKey === BACKLOG_STEP_KEY && autopilot.cardOf(card.id).state === null)
      for (const card of waiting) {
        const first = backlogEntryOf(project.id, card.workflowId)
        if (first === null || lacksCriteria(card.storyId)) {
          continue
        }
        try {
          const moved = await mover.move(card.id, first.key)
          announce(moved)
          patch(card.id, { stepKey: first.key, attempts: 0, advances: 0, pending: null, state: null, reason: null })
        } catch (error) {
          if (abortsLaunch(error, card.id, patch)) {
            return
          }
        }
      }
    }
  }

  async function launchIdle(): Promise<void> {
    for (const project of stories.listProjects()) {
      const settings = autopilot.settingsOf(project.id)
      if (!settings.enabled || !settings.autoLaunch) {
        continue
      }
      const idle = board
        .list(project.id)
        .filter((card) =>
          isIdleLaunchable(
            card,
            columns.list(project.id, card.workflowId).find((candidate) => candidate.key === card.stepKey),
            budgetBlocks,
            (cardId) => autopilot.cardOf(cardId),
          ),
        )
      for (const card of idle) {
        try {
          announce(await mover.launch(card.id))
        } catch (error) {
          if (abortsLaunch(error, card.id, patch)) {
            return
          }
        }
      }
    }
  }

  return { lacksCriteria, budgetBlocks, backlogEntryOf, launchBacklog, launchIdle }
}
