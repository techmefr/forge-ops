import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

const UNKNOWN_ADDRESS = 'unknown'

export function clientAddressOf(context: Context): string {
  const forwarded = context.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() ?? ''
  if (forwarded !== '') {
    return forwarded
  }
  try {
    return getConnInfo(context).remote.address ?? UNKNOWN_ADDRESS
  } catch {
    return UNKNOWN_ADDRESS
  }
}
