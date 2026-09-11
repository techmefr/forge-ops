import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { CheckoutUnreadableError, PathOutsideCheckoutError } from './LocalTreeViolation.js'

export type TreeEntry = {
  path: string
  name: string
  kind: 'directory' | 'file'
  bytes: number | null
}

export type FileReading = {
  path: string
  text: string
  bytes: number
  truncated: boolean
}

const HIDDEN: readonly string[] = ['.git', 'node_modules', 'dist', '.turbo', '.cache', 'coverage']

function insideOf(root: string, asked: string): string {
  const base = resolve(root)
  const full = resolve(base, asked)
  const inside = relative(base, full)
  if (inside.startsWith('..') || inside.startsWith(`${sep}..`)) {
    throw new PathOutsideCheckoutError(asked)
  }
  return full
}

function slashed(root: string, full: string): string {
  return relative(resolve(root), full).split(sep).join('/')
}

export async function listDirectory(root: string, asked: string): Promise<readonly TreeEntry[]> {
  const full = insideOf(root, asked)
  const found = await readdir(full, { withFileTypes: true }).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })

  const kept = found.filter((entry) => !HIDDEN.includes(entry.name))
  const entries = await Promise.all(
    kept.map(async (entry): Promise<TreeEntry> => {
      const child = join(full, entry.name)
      const directory = entry.isDirectory()
      return {
        path: slashed(root, child),
        name: entry.name,
        kind: directory ? 'directory' : 'file',
        bytes: directory ? null : (await stat(child)).size,
      }
    }),
  )

  return entries.sort((left, right) =>
    left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === 'directory' ? -1 : 1,
  )
}

export async function readTextFile(root: string, asked: string, maxBytes: number): Promise<FileReading> {
  const full = insideOf(root, asked)
  const raw = await readFile(full).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })
  return {
    path: slashed(root, full),
    text: raw.subarray(0, maxBytes).toString('utf-8'),
    bytes: raw.byteLength,
    truncated: raw.byteLength > maxBytes,
  }
}

export async function walkPaths(root: string, maxFiles: number): Promise<readonly string[]> {
  const found: string[] = []

  async function descend(asked: string): Promise<void> {
    if (found.length >= maxFiles) {
      return
    }
    for (const entry of await listDirectory(root, asked)) {
      if (found.length >= maxFiles) {
        return
      }
      if (entry.kind === 'file') {
        found.push(entry.path)
        continue
      }
      await descend(entry.path)
    }
  }

  await descend('')
  return found
}
