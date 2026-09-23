import type { WorkflowRefusal } from './Workflow.js'

export class WorkflowRefusedError extends Error {
  constructor(public readonly refusal: WorkflowRefusal) {
    super(`Le workflow est refuse : ${refusal.reason} sur ${refusal.phase}`)
    this.name = 'WorkflowRefusedError'
  }
}
