import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { fromJsonl, toJsonl } from './Template.js'
import type { TemplateRepository } from './TemplateRepository.js'
import { TemplateRefusedError } from './TemplateRepository.js'

const columnSchema = z.object({
  state: z.string().min(1),
  label: z.string().min(1),
  colour: z.string().min(1),
  agent: z.string().nullable(),
  prompt: z.string().nullable(),
  delayHours: z.number().nullable(),
})

const draftSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  isDefault: z.boolean(),
  columns: z.array(columnSchema).min(1),
})

const identifierSchema = z.coerce.number().int().positive()

export type TemplateApiInput = {
  templates: TemplateRepository
  maySettle: (context: Context) => boolean
}

export function createTemplateApi({ templates, maySettle }: TemplateApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof TemplateRefusedError) {
      return context.json({ error: 'TemplateRefused', refusal: error.refusal }, 422)
    }
    return mapApiError(error, context)
  })

  api.get('/api/templates', (context) =>
    context.json({
      templates: templates.listTemplates(),
      defaultTemplate: templates.defaultTemplate(),
      maySettle: maySettle(context),
    }),
  )

  api.get('/api/templates/:id/jsonl', (context) => {
    const templateId = identifierSchema.safeParse(context.req.param('id'))
    if (!templateId.success) {
      return context.json({ error: 'InvalidTemplateIdentifier' }, 422)
    }
    const template = templates.findTemplate(templateId.data)
    if (template === null) {
      return context.json({ error: 'TemplateNotFound' }, 404)
    }
    return context.json({ jsonl: toJsonl(template) })
  })

  api.post('/api/templates', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'TemplateNeedsAnAdmin' }, 403)
    }
    const draft = draftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidTemplate', issues: draft.error.issues }, 422)
    }
    return context.json(templates.writeVersion(draft.data as never), 201)
  })

  api.post('/api/templates/jsonl', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'TemplateNeedsAnAdmin' }, 403)
    }
    const body = await context.req.json().catch(() => null)
    const carried = (body as { jsonl?: unknown })?.jsonl
    if (typeof carried !== 'string') {
      return context.json({ error: 'InvalidTemplateFile' }, 422)
    }
    const read = fromJsonl(carried)
    if (read.draft === undefined) {
      return context.json({ error: 'TemplateRefused', refusal: read.refusal }, 422)
    }
    return context.json(templates.writeVersion(read.draft), 201)
  })

  api.get('/api/projects/:id/template', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(templates.templateOfProject(projectId.data))
  })

  api.post('/api/projects/:id/template', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'TemplateNeedsAnAdmin' }, 403)
    }
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    const body = await context.req.json().catch(() => null)
    const templateId = identifierSchema.safeParse((body as { templateId?: unknown })?.templateId)
    if (!projectId.success || !templateId.success) {
      return context.json({ error: 'InvalidTemplateAdoption' }, 422)
    }
    if (templates.findTemplate(templateId.data) === null) {
      return context.json({ error: 'TemplateNotFound' }, 404)
    }
    templates.adopt(projectId.data, templateId.data)
    return context.json(templates.templateOfProject(projectId.data))
  })

  return api
}
