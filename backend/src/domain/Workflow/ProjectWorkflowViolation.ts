export type WorkflowRefusal =
  | { reason: 'EmptyName' }
  | { reason: 'DuplicateName'; name: string }
  | { reason: 'LastWorkflow' }

export class WorkflowRefusedError extends Error {
  constructor(public readonly refusal: WorkflowRefusal) {
    super(`The workflow is refused: ${refusal.reason}`)
    this.name = 'WorkflowRefusedError'
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(public readonly workflowId: number) {
    super(`No workflow ${workflowId} in this project`)
    this.name = 'WorkflowNotFoundError'
  }
}

export class WorkflowInUseError extends Error {
  constructor(
    public readonly name: string,
    public readonly stories: number,
  ) {
    super(`The workflow ${name} holds ${stories} ${stories === 1 ? 'story' : 'stories'}`)
    this.name = 'WorkflowInUseError'
  }
}
