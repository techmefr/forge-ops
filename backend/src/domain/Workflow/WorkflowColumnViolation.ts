import type { WorkflowColumnRefusal } from './WorkflowColumn.js'

export class WorkflowColumnRefusedError extends Error {
  constructor(public readonly refusal: WorkflowColumnRefusal) {
    super(`La colonne de workflow est refusee : ${refusal.reason}`)
    this.name = 'WorkflowColumnRefusedError'
  }
}
