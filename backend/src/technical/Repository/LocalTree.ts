import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
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

type ResolvedPath = {
  base: string
  full: string
}

const HIDDEN: readonly string[] = ['.git', 'node_modules', 'dist', '.turbo', '.cache', 'coverage']

async function insideOf(root: string, asked: string): Promise<ResolvedPath> {
  const base = await realpath(resolve(root)).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })
  const full = await realpath(resolve(base, asked)).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })
  const inside = relative(base, full)
  if (inside.startsWith('..') || inside.startsWith(`${sep}..`) || isAbsolute(inside)) {
    throw new PathOutsideCheckoutError(asked)
  }
  return { base, full }
}

function slashed(base: string, full: string): string {
  return relative(base, full).split(sep).join('/')
}

export async function listDirectory(root: string, asked: string): Promise<readonly TreeEntry[]> {
  const { base, full } = await insideOf(root, asked)
  const found = await readdir(full, { withFileTypes: true }).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })

  const kept = found.filter((entry) => !HIDDEN.includes(entry.name))
  const entries = await Promise.all(
    kept.map(async (entry): Promise<TreeEntry> => {
      const child = join(full, entry.name)
      const directory = entry.isDirectory()
      const measured = directory ? null : await stat(child).catch(() => null)
      return {
        path: slashed(base, child),
        name: entry.name,
        kind: directory ? 'directory' : 'file',
        bytes: measured === null ? null : measured.size,
      }
    }),
  )

  return entries.sort((left, right) =>
    left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === 'directory' ? -1 : 1,
  )
}

export async function readTextFile(root: string, asked: string, maxBytes: number): Promise<FileReading> {
  const { base, full } = await insideOf(root, asked)
  const raw = await readFile(full).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })
  return {
    path: slashed(base, full),
    text: raw.subarray(0, maxBytes).toString('utf-8'),
    bytes: raw.byteLength,
    truncated: raw.byteLength > maxBytes,
  }
}

export type FileStamp = {
  path: string
  mtimeMs: number
}

export async function statTextFile(root: string, asked: string): Promise<FileStamp> {
  const { base, full } = await insideOf(root, asked)
  const measured = await stat(full).catch((error: Error) => {
    throw new CheckoutUnreadableError(asked, error.message)
  })
  return { path: slashed(base, full), mtimeMs: measured.mtimeMs }
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
