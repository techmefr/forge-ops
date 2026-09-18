import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  agreementOf,
  announcementOf,
  CONTRACT_VERSION,
  heldBy,
  INSTANCE_HELD,
  SERVER_HELD,
  unplaced,
} from '../../../src/domain/Boundary/Boundary.js'
import { createOutboxRepository } from '../../../src/domain/Boundary/OutboxRepository.js'

let db: Database.Database
let outbox: ReturnType<typeof createOutboxRepository>

beforeAll(() => {
  db = openDatabase(':memory:')
  outbox = createOutboxRepository(db)
})

afterEach(() => {
  db.exec('DELETE FROM sync_outbox; DELETE FROM sqlite_sequence')
})

describe('the boundary between the two stores', () => {
  it('puts what is shared on the server and what executes on the instance', () => {
    expect(heldBy('story')).toBe('server')
    expect(heldBy('agent_session')).toBe('instance')
    expect(heldBy('checkpoint')).toBe('instance')
  })

  it('never puts a table on both sides', () => {
    expect(SERVER_HELD.filter((table) => INSTANCE_HELD.includes(table))).toEqual([])
  })

  it('names nothing it does not place', () => {
    expect(heldBy('la lune')).toBeNull()
    expect(unplaced(['story', 'la lune'])).toEqual(['la lune'])
  })

  it('places every table the schema declares, or says which one it forgot', () => {
    const schema = readFileSync(new URL('../../../../db/forge.sql', import.meta.url), 'utf8')
    const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((found) => found[1] ?? '')
    expect(tables.length).toBeGreaterThan(20)
    expect(unplaced(tables)).toEqual([])
  })
})

describe('a contract that is versioned', () => {
  it('lets a recent instance talk to a server of the same major', () => {
    expect(agreementOf(CONTRACT_VERSION, CONTRACT_VERSION)).toBe('compatible')
    expect(agreementOf('1.0.0', '1.4.2')).toBe('compatible')
  })

  it('says which of the two is behind', () => {
    expect(agreementOf('2.0.0', '1.9.9')).toBe('instanceTooOld')
    expect(agreementOf('1.0.0', '2.0.0')).toBe('serverTooOld')
  })
})

describe('a tool that runs agents never updates itself in silence', () => {
  it('says what it would install without installing it', () => {
    expect(announcementOf('0.1.0', '0.2.0')).toEqual({
      installed: '0.1.0',
      offered: '0.2.0',
      wouldInstall: true,
    })
  })

  it('announces nothing when there is nothing to install', () => {
    expect(announcementOf('0.1.0', '0.1.0').wouldInstall).toBe(false)
  })
})

describe('the instance keeps working when the server is unreachable', () => {
  it('queues what it owes, in order', () => {
    outbox.owe('story.advanced', { reference: 'FORGE-1' })
    outbox.owe('story.advanced', { reference: 'FORGE-2' })
    expect(outbox.depth()).toBe(2)
    expect(outbox.owed().map((entry) => JSON.parse(entry.payload).reference)).toEqual([
      'FORGE-1',
      'FORGE-2',
    ])
  })

  it('stops owing what it has sent, and keeps the rest', () => {
    const first = outbox.owe('story.advanced', { reference: 'FORGE-1' })
    outbox.owe('story.advanced', { reference: 'FORGE-2' })
    outbox.settle(first.id)
    expect(outbox.depth()).toBe(1)
    expect(outbox.owed()[0]?.id).not.toBe(first.id)
  })

  it('settles the same entry twice without owing it again', () => {
    const only = outbox.owe('story.advanced', { reference: 'FORGE-1' })
    outbox.settle(only.id)
    outbox.settle(only.id)
    expect(outbox.depth()).toBe(0)
  })

  it('counts a failed attempt without losing the debt', () => {
    const only = outbox.owe('story.advanced', { reference: 'FORGE-1' })
    expect(outbox.failed(only.id).attempts).toBe(1)
    expect(outbox.failed(only.id).attempts).toBe(2)
    expect(outbox.depth()).toBe(1)
  })
})
