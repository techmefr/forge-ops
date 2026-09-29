import type { Context } from 'hono'

export function cookieSecure(context: Context): boolean {
  if (context.req.header('x-forwarded-proto')?.split(',')[0]?.trim() === 'https') {
    return true
  }
  return new URL(context.req.url).protocol === 'https:'
}
