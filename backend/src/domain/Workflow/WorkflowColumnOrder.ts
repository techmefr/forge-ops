import type Database from 'better-sqlite3'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { WorkflowColumnStatements } from './WorkflowColumnStatements.js'
import { WorkflowColumnRefusedError } from './WorkflowColumnViolation.js'

export function createWorkflowColumnOrder(
  db: Database.Database,
  { updatePosition }: WorkflowColumnStatements,
  list: (projectId: number, workflowId?: number) => readonly WorkflowColumn[],
) {
  return (projectId: number, keysInOrder: readonly string[], workflowId?: number): readonly WorkflowColumn[] => {
    const current = list(projectId, workflowId)
    const sameSet =
      keysInOrder.length === current.length &&
      new Set(keysInOrder).size === current.length &&
      current.every((column) => keysInOrder.includes(column.key))
    if (!sameSet) {
      throw new WorkflowColumnRefusedError({ reason: 'OrderMismatch' })
    }
    db.transaction(() => {
      keysInOrder.forEach((key, index) => {
        updatePosition.run(-1 * (index + 1), current.find((column) => column.key === key)!.id)
      })
      keysInOrder.forEach((key, index) => {
        updatePosition.run(index + 1, current.find((column) => column.key === key)!.id)
      })
    })()
    return list(projectId, workflowId)
  }
}
