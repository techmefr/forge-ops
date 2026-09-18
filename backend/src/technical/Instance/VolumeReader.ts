import { accessSync, constants, existsSync } from 'node:fs'
import { dirname } from 'node:path'

export type ReadVolume = {
  path: string
  exists: boolean
  writable: boolean
  hasDatabase: boolean
}

export function readVolume(dbPath: string): ReadVolume {
  const path = dirname(dbPath)
  const exists = existsSync(path)
  let writable = false
  if (exists) {
    try {
      accessSync(path, constants.W_OK)
      writable = true
    } catch {
      writable = false
    }
  }
  return { path, exists, writable, hasDatabase: existsSync(dbPath) }
}
