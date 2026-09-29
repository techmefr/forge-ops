import { createHash } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi

export function inlineScriptHashes(html: string): readonly string[] {
  return [...html.matchAll(INLINE_SCRIPT)]
    .map((match) => match[1] ?? '')
    .filter((source) => source.trim() !== '')
    .map((source) => `sha256-${createHash('sha256').update(source).digest('base64')}`)
}

export function contentSecurityPolicy(html: string): string {
  const scripts = ["'self'", ...inlineScriptHashes(html).map((hash) => `'${hash}'`)]
  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export function securityHeaders(): MiddlewareHandler {
  return async (context, next) => {
    await next()
    context.header('x-content-type-options', 'nosniff')
    context.header('x-frame-options', 'DENY')
    context.header('referrer-policy', 'no-referrer')
    if (context.req.path.startsWith('/api/')) {
      context.header('cache-control', 'no-store')
    }
  }
}
