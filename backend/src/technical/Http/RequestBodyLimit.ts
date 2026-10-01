import type { MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'

export const GLOBAL_BODY_LIMIT_BYTES = 1024 * 1024

export const AUTH_BODY_LIMIT_BYTES = 8 * 1024

const AUTH_PATH_PREFIX = '/api/auth/'

function limitTo(maxSize: number): MiddlewareHandler {
  return bodyLimit({
    maxSize,
    onError: (context) => context.json({ error: 'PayloadTooLarge' }, 413),
  })
}

export function requestBodyLimit(): MiddlewareHandler {
  const global = limitTo(GLOBAL_BODY_LIMIT_BYTES)
  const auth = limitTo(AUTH_BODY_LIMIT_BYTES)
  return (context, next) => (context.req.path.startsWith(AUTH_PATH_PREFIX) ? auth(context, next) : global(context, next))
}
