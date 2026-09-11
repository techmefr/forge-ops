import { createHash } from 'node:crypto'

export const DEFAULT_BASE_PORT = 4000
export const DEFAULT_PORT_RANGE = 2000

function hashToUint32(value: string): number {
  const digest = createHash('sha256').update(value).digest()
  return digest.readUInt32BE(0)
}

export function allocatePort(
  branchName: string,
  basePort: number = DEFAULT_BASE_PORT,
  range: number = DEFAULT_PORT_RANGE,
): number {
  const hash = hashToUint32(branchName)
  return (hash % range) + basePort
}
