import type { Hono } from 'hono'
import { readTextFile, statTextFile } from '../../technical/Repository/LocalTree.js'
import { PathOutsideCheckoutError, SensitivePathError } from '../../technical/Repository/LocalTreeViolation.js'
import type { CodeRenderer } from '../../technical/File/CodeRender.js'
import type { HighlightCache } from '../../technical/File/HighlightCache.js'
import { describeFile } from './FileDigest.js'
import { outsideRoots, saidBy, type HolderResolver } from './FileHolder.js'
import { markOfFile } from './FileMark.js'

type Highlight = { html: string; known: boolean }

type ReadInput = {
  maxFileBytes: number
  codeRenderer: CodeRenderer
  highlightCache: HighlightCache<Highlight>
}

export function mountFileReadRoute(api: Hono, { holderOf }: HolderResolver, { maxFileBytes, codeRenderer, highlightCache }: ReadInput): void {
  async function highlightOf(path: string, text: string, mtimeMs: number): Promise<Highlight> {
    const cacheKey = { path, mtimeMs }
    const cached = highlightCache.get(cacheKey)
    if (cached !== null) {
      return cached
    }
    const rendered = await codeRenderer.renderedOf(text, path)
    const highlight = { html: rendered.html, known: rendered.known }
    if (!rendered.timedOut) {
      highlightCache.set(cacheKey, highlight)
    }
    return highlight
  }

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
      const stamp = await statTextFile(holder.checkoutPath, asked)
      const highlight = await highlightOf(reading.path, reading.text, stamp.mtimeMs)
      return context.json({
        ...reading,
        description: describeFile(reading.path),
        ...markOfFile({ onDisk: true, touches: holder.touches.get(reading.path) ?? [] }),
        highlightedHtml: highlight.html,
        highlightAvailable: highlight.known,
      })
    } catch (error) {
      if (error instanceof PathOutsideCheckoutError) {
        return context.json({ error: 'PathOutsideCheckout' }, 422)
      }
      if (error instanceof SensitivePathError) {
        return context.json({ error: 'PathNotServed' }, 403)
      }
      return context.json({ error: 'FileUnreadable', reason: saidBy(error) }, 404)
    }
  })
}
