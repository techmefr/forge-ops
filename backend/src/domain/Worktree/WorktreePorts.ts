import { allocatePort, DEFAULT_BASE_PORT, DEFAULT_PORT_RANGE } from '../../technical/Network/PortAllocator.js'
import type { WorktreeStatements } from './WorktreeStatements.js'
import { WorktreeNotRemovableError } from './WorktreeViolation.js'

export function createWorktreePorts(
  { takenPort, previousPort }: WorktreeStatements,
  isPortFree: (port: number) => boolean,
) {
  return (branch: string, worktreeId: number): number => {
    const held = previousPort.get(worktreeId)
    if (held !== undefined && takenPort.get(held.port) === undefined && isPortFree(held.port)) {
      return held.port
    }
    const wanted = allocatePort(branch)
    for (let step = 0; step < DEFAULT_PORT_RANGE; step += 1) {
      const candidate = ((wanted - DEFAULT_BASE_PORT + step) % DEFAULT_PORT_RANGE) + DEFAULT_BASE_PORT
      if (takenPort.get(candidate) === undefined && isPortFree(candidate)) {
        return candidate
      }
    }
    throw new WorktreeNotRemovableError(branch, 'plus aucun port libre dans la plage')
  }
}
