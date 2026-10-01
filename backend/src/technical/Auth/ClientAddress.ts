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

const LOOPBACK_PEERS: readonly string[] = ['127.0.0.1', '::1', '::ffff:127.0.0.1']

export function isLoopbackPeer(context: Context): boolean {
  try {
    return LOOPBACK_PEERS.includes(getConnInfo(context).remote.address ?? UNKNOWN_ADDRESS)
  } catch {
    return false
  }
}
