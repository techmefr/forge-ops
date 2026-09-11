import { stat } from 'node:fs/promises'
import { Hono } from 'hono'
import { z } from 'zod'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { listDirectory, readTextFile, walkPaths } from '../../technical/Repository/LocalTree.js'
import { PathOutsideCheckoutError } from '../../technical/Repository/LocalTreeViolation.js'
import { assertCheckoutPath, CheckoutPathRefusedError } from '../Story/CheckoutPath.js'
import { describeFile } from './FileDigest.js'
import { markOfFile, type FileTouch } from './FileMark.js'
import { clashesOf } from './NameClash.js'
import type { FileRepository } from './FileRepository.js'

export type FileApiInput = {
  stories: StoryRepository
  files: FileRepository
  maxFileBytes?: number
  maxWalkedFiles?: number
  checkoutRoots?: readonly string[]
}

const identifierSchema = z.coerce.number().int().positive()

const checkoutSchema = z.object({ checkoutPath: z.string().min(1) })

async function isDirectory(path: string): Promise<boolean> {
  return stat(path)
    .then((found) => found.isDirectory())
    .catch(() => false)
}

const DEFAULT_MAX_FILE_BYTES = 200_000
const DEFAULT_MAX_WALKED_FILES = 4000

type Holder = {
  checkoutPath: string
  touches: Map<string, readonly FileTouch[]>
}

function saidBy(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createFileApi({
  stories,
  files,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxWalkedFiles = DEFAULT_MAX_WALKED_FILES,
  checkoutRoots = [process.cwd()],
}: FileApiInput): Hono {
  const api = new Hono()

  function outsideRoots(holder: Holder | { refused: string }): holder is { refused: string } {
    return 'refused' in holder
  }

  function holderOf(rawId: string): Holder | 'unknown-project' | 'unknown-checkout' | { refused: string } {
    const projectId = identifierSchema.safeParse(rawId)
    if (!projectId.success) {
      return 'unknown-project'
    }
    const project = stories.listProjects().find((known) => known.id === projectId.data)
    if (project === undefined) {
      return 'unknown-project'
    }
    if (project.checkoutPath === null || project.checkoutPath === '') {
      return 'unknown-checkout'
    }
    try {
      assertCheckoutPath(project.checkoutPath, checkoutRoots)
    } catch (error) {
      return { refused: error instanceof CheckoutPathRefusedError ? error.message : saidBy(error) }
    }
    return { checkoutPath: project.checkoutPath, touches: files.touchesOfProject(projectId.data) }
  }

  api.get('/api/projects/:id/tree', async (context) => {
    const holder = holderOf(context.req.param('id'))
    if (holder === 'unknown-project') {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    if (holder === 'unknown-checkout') {
      return context.json({ available: false, reason: 'CheckoutUnknown', entries: [] })
    }
    if (outsideRoots(holder)) {
      return context.json({ error: 'CheckoutPathRefused', reason: holder.refused }, 422)
    }

    const asked = context.req.query('path') ?? ''
    try {
      const entries = await listDirectory(holder.checkoutPath, asked)
      const seen = new Set(entries.map((entry) => entry.path))
      const inside = (path: string): boolean =>
        asked === ''
          ? !path.includes('/')
          : path.startsWith(`${asked}/`) && !path.slice(asked.length + 1).includes('/')
      const missing = [...holder.touches.keys()].filter((path) => !seen.has(path) && inside(path))

      const said = [
        ...entries.map((entry) => {
          const verdict = markOfFile({
            onDisk: true,
            touches: holder.touches.get(entry.path) ?? [],
          })
          return { ...entry, description: describeFile(entry.path), ...verdict }
        }),
        ...missing.map((path) => ({
          path,
          name: path.split('/').pop() ?? path,
          kind: 'file' as const,
          bytes: null,
          description: describeFile(path),
          ...markOfFile({ onDisk: false, touches: holder.touches.get(path) ?? [] }),
        })),
      ].sort((left, right) =>
        left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === 'directory' ? -1 : 1,
      )

      return context.json({ available: true, reason: null, entries: said })
    } catch (error) {
      if (error instanceof PathOutsideCheckoutError) {
        return context.json({ error: 'PathOutsideCheckout' }, 422)
      }
      return context.json({ available: false, reason: saidBy(error), entries: [] })
    }
  })

  api.get('/api/projects/:id/file', async (context) => {
    const holder = holderOf(context.req.param('id'))
    if (holder === 'unknown-project') {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    if (holder === 'unknown-checkout') {
      return context.json({ error: 'CheckoutUnknown' }, 404)
    }
    if (outsideRoots(holder)) {
      return context.json({ error: 'CheckoutPathRefused', reason: holder.refused }, 422)
    }

    const asked = context.req.query('path') ?? ''
    try {
      const reading = await readTextFile(holder.checkoutPath, asked, maxFileBytes)
      return context.json({
        ...reading,
        description: describeFile(reading.path),
        ...markOfFile({ onDisk: true, touches: holder.touches.get(reading.path) ?? [] }),
      })
    } catch (error) {
      if (error instanceof PathOutsideCheckoutError) {
        return context.json({ error: 'PathOutsideCheckout' }, 422)
      }
      return context.json({ error: 'FileUnreadable', reason: saidBy(error) }, 404)
    }
  })

  api.put('/api/projects/:id/checkout', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (stories.listProjects().find((known) => known.id === projectId.data) === undefined) {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    const body = checkoutSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidCheckoutPath', issues: body.error.issues }, 422)
    }
    if (!(await isDirectory(body.data.checkoutPath))) {
      return context.json({ error: 'CheckoutNotADirectory' }, 422)
    }
    try {
      return context.json(stories.setCheckoutPath(projectId.data, body.data.checkoutPath))
    } catch (error) {
      if (error instanceof CheckoutPathRefusedError) {
        return context.json({ error: 'CheckoutPathRefused', reason: error.message }, 422)
      }
      throw error
    }
  })

  api.get('/api/projects/:id/clashes', async (context) => {
    const holder = holderOf(context.req.param('id'))
    if (holder === 'unknown-project') {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    if (holder === 'unknown-checkout') {
      return context.json({ available: false, reason: 'CheckoutUnknown', clashes: [] })
    }
    if (outsideRoots(holder)) {
      return context.json({ error: 'CheckoutPathRefused', reason: holder.refused }, 422)
    }

    try {
      const walked = await walkPaths(holder.checkoutPath, maxWalkedFiles)
      const planned = [...holder.touches.keys()]
      return context.json({
        available: true,
        reason: null,
        clashes: clashesOf([...new Set([...walked, ...planned])]),
      })
    } catch (error) {
      return context.json({ available: false, reason: saidBy(error), clashes: [] })
    }
  })

  return api
}
