import { z } from 'zod'

export const workflowDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
  })
  .strict()

export type WorkflowDraft = z.infer<typeof workflowDraftSchema>

export const workflowDuplicateSchema = workflowDraftSchema

export type Workflow = {
  id: number
  projectId: number
  key: string
  name: string
  position: number
}

export type ProjectWorkflows = {
  workflows: readonly Workflow[]
  maySettle: boolean
}
