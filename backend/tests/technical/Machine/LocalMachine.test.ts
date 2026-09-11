import { describe, expect, it } from 'vitest'
import { snapshotOfMachine } from '../../../src/technical/Machine/LocalMachine.js'

const MB = 1024 * 1024

const READING = {
  before: { idle: 1000, total: 2000 },
  after: { idle: 1400, total: 3000 },
  memoryTotalBytes: 32 * 1024 * MB,
  memoryFreeBytes: 8 * 1024 * MB,
  diskTotalBytes: 500 * 1024 * MB,
  diskFreeBytes: 125 * 1024 * MB,
  loadAverage: 1.25,
}

describe('snapshotOfMachine', () => {
  it('reads the cpu from what changed between the two samples', () => {
    expect(snapshotOfMachine(READING).cpuPercent).toBe(60)
  })

  it('says nothing about the cpu when the two samples are the same', () => {
    expect(snapshotOfMachine({ ...READING, after: READING.before }).cpuPercent).toBeNull()
  })

  it('reports the memory in use and the memory left', () => {
    expect(snapshotOfMachine(READING)).toMatchObject({
      memoryUsedMb: 24576,
      memoryFreeMb: 8192,
    })
  })

  it('reports how full the disk is', () => {
    expect(snapshotOfMachine(READING).diskPercent).toBe(75)
  })

  it('says nothing about a disk of no size', () => {
    expect(snapshotOfMachine({ ...READING, diskTotalBytes: 0 }).diskPercent).toBeNull()
  })

  it('carries the load average as the machine gave it', () => {
    expect(snapshotOfMachine(READING).loadAverage).toBe(1.25)
  })
})
