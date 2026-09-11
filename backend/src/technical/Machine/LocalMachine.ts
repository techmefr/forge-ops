import { freemem, loadavg, totalmem, cpus } from 'node:os'
import { statfs } from 'node:fs/promises'
import type { MachineSnapshot } from '../../domain/Resource/MachineSnapshot.js'

export type CpuSample = { idle: number; total: number }

export type MachineReading = {
  before: CpuSample
  after: CpuSample
  memoryTotalBytes: number
  memoryFreeBytes: number
  diskTotalBytes: number
  diskFreeBytes: number
  loadAverage: number
}

const BYTES_PER_MB = 1024 * 1024

function rounded(value: number, places: number): number {
  return Number(value.toFixed(places))
}

function cpuPercentOf(before: CpuSample, after: CpuSample): number | null {
  const spent = after.total - before.total
  if (spent <= 0) {
    return null
  }
  const idle = after.idle - before.idle
  return rounded(((spent - idle) / spent) * 100, 1)
}

function diskPercentOf(total: number, free: number): number | null {
  if (total <= 0) {
    return null
  }
  return rounded(((total - free) / total) * 100, 1)
}

export function snapshotOfMachine(reading: MachineReading): MachineSnapshot {
  return {
    cpuPercent: cpuPercentOf(reading.before, reading.after),
    memoryUsedMb: rounded((reading.memoryTotalBytes - reading.memoryFreeBytes) / BYTES_PER_MB, 0),
    memoryFreeMb: rounded(reading.memoryFreeBytes / BYTES_PER_MB, 0),
    diskPercent: diskPercentOf(reading.diskTotalBytes, reading.diskFreeBytes),
    loadAverage: reading.loadAverage,
  }
}

function sampleCpu(): CpuSample {
  return cpus().reduce(
    (kept, core) => {
      const spent = Object.values(core.times).reduce((sum, slice) => sum + slice, 0)
      return { idle: kept.idle + core.times.idle, total: kept.total + spent }
    },
    { idle: 0, total: 0 },
  )
}

export async function readLocalMachine(path: string, windowMs = 150): Promise<MachineSnapshot> {
  const before = sampleCpu()
  await new Promise((settled) => setTimeout(settled, windowMs))
  const disk = await statfs(path)
  return snapshotOfMachine({
    before,
    after: sampleCpu(),
    memoryTotalBytes: totalmem(),
    memoryFreeBytes: freemem(),
    diskTotalBytes: disk.blocks * disk.bsize,
    diskFreeBytes: disk.bavail * disk.bsize,
    loadAverage: rounded(loadavg()[0] ?? 0, 2),
  })
}
