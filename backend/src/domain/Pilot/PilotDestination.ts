import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { bareHostname, isPublicAddress } from '../../technical/Network/HostAddress.js'
import { UnsafeDestinationError } from './PilotViolation.js'

export type HostLookup = (hostname: string) => Promise<readonly string[]>

export type DestinationPolicyInput = {
  previewPortOf: (storyId: number) => number | null
  allowedOrigins?: readonly string[]
  resolve?: HostLookup
}

export type DestinationPolicy = {
  assertAllowed: (target: string, storyId: number) => Promise<void>
  isAllowed: (target: string, storyId: number) => Promise<boolean>
}

const WEB_SCHEMES: readonly string[] = ['http:', 'https:']

const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]']

async function resolveAddresses(hostname: string): Promise<readonly string[]> {
  const found = await lookup(hostname, { all: true })
  return found.map((entry) => entry.address)
}

function originOf(target: URL): string {
  return target.origin
}

export function parseAllowedOrigins(declared: string | undefined): readonly string[] {
  return (declared ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .flatMap((entry) => {
      try {
        return [new URL(entry).origin]
      } catch {
        return []
      }
    })
}

export function createDestinationPolicy({
  previewPortOf,
  allowedOrigins = [],
  resolve = resolveAddresses,
}: DestinationPolicyInput): DestinationPolicy {
  function previewOrigins(storyId: number): readonly string[] {
    const port = previewPortOf(storyId)
    return port === null ? [] : LOOPBACK_HOSTS.map((host) => `http://${host}:${port}`)
  }

  async function reachesOnlyPublicHosts(hostname: string): Promise<boolean> {
    const bare = bareHostname(hostname)
    if (isIP(bare) !== 0) {
      return isPublicAddress(bare)
    }
    const addresses = await resolve(bare).catch(() => [])
    return addresses.length > 0 && addresses.every(isPublicAddress)
  }

  async function isAllowed(target: string, storyId: number): Promise<boolean> {
    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return false
    }
    if (parsed.protocol === 'about:' && target === 'about:blank') {
      return true
    }
    if (!WEB_SCHEMES.includes(parsed.protocol)) {
      return false
    }
    if ([...allowedOrigins, ...previewOrigins(storyId)].includes(originOf(parsed))) {
      return true
    }
    return reachesOnlyPublicHosts(parsed.hostname)
  }

  return {
    isAllowed,
    assertAllowed: async (target, storyId) => {
      if (!(await isAllowed(target, storyId))) {
        throw new UnsafeDestinationError(target)
      }
    },
  }
}
