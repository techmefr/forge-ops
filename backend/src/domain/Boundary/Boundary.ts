export {
  AGREEMENTS,
  CONTRACT_VERSION,
  INSTANCE_HELD,
  SERVER_HELD,
  SIDES,
} from '../../../../contract/BoundaryContract.js'
export type {
  Agreement,
  Announcement,
  OutboxEntry,
  Side,
} from '../../../../contract/BoundaryContract.js'

import {
  INSTANCE_HELD,
  SERVER_HELD,
  type Agreement,
  type Announcement,
  type Side,
} from '../../../../contract/BoundaryContract.js'

export function heldBy(table: string): Side | null {
  if (SERVER_HELD.includes(table)) {
    return 'server'
  }
  return INSTANCE_HELD.includes(table) ? 'instance' : null
}

export function unplaced(tables: readonly string[]): readonly string[] {
  return tables.filter((table) => heldBy(table) === null)
}

function majorOf(version: string): number {
  return Number(version.split('.')[0] ?? Number.NaN)
}

export function agreementOf(serverVersion: string, instanceVersion: string): Agreement {
  const server = majorOf(serverVersion)
  const instance = majorOf(instanceVersion)
  if (Number.isNaN(server) || Number.isNaN(instance) || server === instance) {
    return 'compatible'
  }
  return instance < server ? 'instanceTooOld' : 'serverTooOld'
}

export function announcementOf(installed: string, offered: string): Announcement {
  return { installed, offered, wouldInstall: offered !== installed }
}
