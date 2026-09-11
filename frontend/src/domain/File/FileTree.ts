import type { FileMark } from './FileMarkTone'

export type TreeEntry = {
  path: string
  name: string
  kind: 'directory' | 'file'
  bytes: number | null
  description: string
  mark: FileMark
  byReferences: readonly string[]
  agentName: string | null
}

export type TreeReading = {
  available: boolean
  reason: string | null
  entries: readonly TreeEntry[]
}

export type FileReading = {
  path: string
  text: string
  bytes: number
  truncated: boolean
  description: string
  mark: FileMark
  byReferences: readonly string[]
  agentName: string | null
}

export type ClashReading = {
  available: boolean
  reason: string | null
  clashes: readonly { name: string; paths: readonly string[] }[]
}
