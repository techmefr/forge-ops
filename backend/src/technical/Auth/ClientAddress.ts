import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

const UNKNOWN_ADDRESS = 'unknown'

export const TRUST_PROXY_ENV = 'FORGE_TRUST_PROXY'

export function trustProxyFromEnv(): boolean {
  return process.env[TRUST_PROXY_ENV] === 'true'
}

function peerAddressOf(context: Context): string {
  try {
    return getConnInfo(context).remote.address ?? UNKNOWN_ADDRESS
  } catch {
    return UNKNOWN_ADDRESS
  }
}

export function clientAddressOf(context: Context, trustProxy: boolean = trustProxyFromEnv()): string {
  if (trustProxy) {
    const forwarded = context.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() ?? ''
    if (forwarded !== '') {
      return forwarded
    }
  }
  return peerAddressOf(context)
}

const LOOPBACK_PEERS: readonly string[] = ['127.0.0.1', '::1', '::ffff:127.0.0.1']

export function isLoopbackPeer(context: Context): boolean {
  return LOOPBACK_PEERS.includes(peerAddressOf(context))
}
