import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { LensOutOfOrderError } from '../Checkpoint/CheckpointViolation.js'
import { LENS_AGENTS, nextLensOf } from '../Checkpoint/ReviewCascade.js'
import { COLUMN_OF_PHASE } from '../Driver/Driver.js'
import type { Story } from '../Story/Story.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { WorkflowRepository } from '../Workflow/WorkflowRepository.js'
import { contractOfPhase, type DispatchOrder, type PhaseContract } from './Dispatch.js'
import { HumanStepError, LensOutsideReviewError, UnknownStepError } from './DispatchViolation.js'

export type ConfiguredPhase = ReturnType<WorkflowRepository['readPhases']>[number]

export type ResolvedDispatch = {
  story: Story
  step: WorkflowColumn | null
  configured: ConfiguredPhase | undefined
  contract: PhaseContract
  agentName: string
}

type ContractInput = {
  stories: StoryRepository
  checkpoints: CheckpointRepository
  workflow: WorkflowRepository
  workflowColumns: WorkflowColumnRepository
}

export function createContractResolver({ stories, checkpoints, workflow, workflowColumns }: ContractInput) {
  function stepOf(order: DispatchOrder): WorkflowColumn | null {
    const projectId = stories.projectOfStory(order.storyId)
    if (order.columnId !== undefined) {
      const column = workflowColumns.find(order.columnId)
      if (column === null || column.projectId !== projectId) {
        throw new UnknownStepError(order.columnId)
      }
      return column
    }
    const key = COLUMN_OF_PHASE[order.phase]
    return workflowColumns.list(projectId).find((column) => column.key === key) ?? null
  }

  function contractOf(order: DispatchOrder, step: WorkflowColumn | null, configured: ConfiguredPhase | undefined): PhaseContract {
    const staticContract = contractOfPhase(order.phase)
    const phaseContract: PhaseContract =
      configured === undefined
        ? staticContract
        : { ...staticContract, agentName: configured.agentName, command: configured.command }
    return step === null
      ? phaseContract
      : {
          ...phaseContract,
          agentName: step.agentName === '' ? phaseContract.agentName : step.agentName,
          command: step.command === '' ? phaseContract.command : step.command,
        }
  }

  function assertLensInOrder(order: DispatchOrder): void {
    if (order.lens === undefined) {
      return
    }
    const expected = nextLensOf(checkpoints.reviewCascade(order.storyId))
    if (expected !== order.lens) {
      throw new LensOutOfOrderError(order.lens, expected ?? order.lens)
    }
  }

  function resolve(order: DispatchOrder): ResolvedDispatch {
    const story = stories.findStory(order.storyId)
    const step = stepOf(order)
    if (step !== null && step.provider === 'human') {
      throw new HumanStepError(step.label)
    }
    const configured = workflow.readPhases().find((entry) => entry.phase === order.phase)
    const contract = contractOf(order, step, configured)
    if (order.lens !== undefined && order.phase !== 'review') {
      throw new LensOutsideReviewError(order.phase)
    }
    const agentName = order.lens === undefined ? contract.agentName : LENS_AGENTS[order.lens]
    assertLensInOrder(order)
    return { story, step, configured, contract, agentName }
  }

  return { resolve }
}
