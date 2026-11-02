import type { Hono } from 'hono'
import { listDirectory, walkPaths } from '../../technical/Repository/LocalTree.js'
import { PathOutsideCheckoutError, SensitivePathError } from '../../technical/Repository/LocalTreeViolation.js'
import { isSensitivePath } from '../../technical/Repository/SensitivePath.js'
import { describeFile } from './FileDigest.js'
import { outsideRoots, saidBy, type Holder, type HolderResolver } from './FileHolder.js'
import { markOfFile } from './FileMark.js'
import { clashesOf } from './NameClash.js'

type DirectoryEntry = Awaited<ReturnType<typeof listDirectory>>[number]

function isDirectChildOf(asked: string, path: string): boolean {
  return asked === ''
    ? !path.includes('/')
    : path.startsWith(`${asked}/`) && !path.slice(asked.length + 1).includes('/')
}

function describedEntries(holder: Holder, entries: readonly DirectoryEntry[], asked: string) {
  const seen = new Set(entries.map((entry) => entry.path))
  const missing = [...holder.touches.keys()].filter(
    (path) => !seen.has(path) && isDirectChildOf(asked, path) && !isSensitivePath(path),
  )
  return [
    ...entries.map((entry) => ({
      ...entry,
      description: describeFile(entry.path),
      ...markOfFile({ onDisk: true, touches: holder.touches.get(entry.path) ?? [] }),
    })),
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
}

export function mountFileTreeRoutes(
  api: Hono,
  { holderOf }: HolderResolver,
  maxWalkedFiles: number,
): void {
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
      return context.json({ available: true, reason: null, entries: describedEntries(holder, entries, asked) })
    } catch (error) {
      if (error instanceof PathOutsideCheckoutError) {
        return context.json({ error: 'PathOutsideCheckout' }, 422)
      }
      if (error instanceof SensitivePathError) {
        return context.json({ error: 'PathNotServed' }, 403)
      }
      return context.json({ available: false, reason: saidBy(error), entries: [] })
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
}
