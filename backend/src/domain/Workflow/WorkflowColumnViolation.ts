import type { WorkflowColumnRefusal } from './WorkflowColumn.js'

export class WorkflowColumnRefusedError extends Error {
  constructor(public readonly refusal: WorkflowColumnRefusal) {
    super(`The workflow step is refused: ${refusal.reason}`)
    this.name = 'WorkflowColumnRefusedError'
  }
}

export class WorkflowColumnNotFoundError extends Error {
  constructor(public readonly columnId: number) {
    super(`No workflow step ${columnId} in this project`)
    this.name = 'WorkflowColumnNotFoundError'
  }
}

export class WorkflowColumnInUseError extends Error {
  constructor(
    public readonly label: string,
    public readonly stories: number,
  ) {
    super(`The step ${label} holds ${stories} ${stories === 1 ? 'story' : 'stories'}`)
    this.name = 'WorkflowColumnInUseError'
  }
}
