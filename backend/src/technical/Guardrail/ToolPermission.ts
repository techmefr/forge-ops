import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { isProtectedPath } from './ProtectedPaths.js'
import { allowsTool, EVIDENCE_FOLDER, isShellTool, isWritingTool, writesEvidenceOnly } from './PhaseToolPolicy.js'

export type ToolPermission = { behavior: 'allow' } | { behavior: 'deny'; message: string }

export type ToolPermissionQuestion = {
  phase: string
  tool: string
  input: Record<string, unknown>
  root: string
}

const PATH_FIELDS = ['file_path', 'notebook_path', 'path'] as const

function realOf(path: string): string {
  let probe = resolve(path)
  while (!existsSync(probe)) {
    const parent = dirname(probe)
    if (parent === probe) {
      return resolve(path)
    }
    probe = parent
  }
  return resolve(realpathSync(probe), relative(probe, resolve(path)))
}

function contains(folder: string, path: string): boolean {
  const walked = relative(realOf(folder), realOf(path))
  return walked !== '' && !walked.startsWith('..') && !isAbsolute(walked)
}

function pathsOf(input: Record<string, unknown>, root: string): string[] {
  return PATH_FIELDS.flatMap((field) => {
    const value = input[field]
    return typeof value === 'string' && value.trim() !== '' ? [resolve(root, value)] : []
  })
}

function denied(message: string): ToolPermission {
  return { behavior: 'deny', message }
}

export function decideToolPermission({ phase, tool, input, root }: ToolPermissionQuestion): ToolPermission {
  const evidenceWrite = writesEvidenceOnly(phase, tool)
  if (!evidenceWrite && !allowsTool(phase, tool)) {
    return denied(`Tool ${tool} is not part of the ${phase} phase`)
  }
  const paths = pathsOf(input, root)
  if (isWritingTool(tool) && paths.length === 0) {
    return denied(`${tool} without a file path cannot be checked`)
  }
  const guarded = isWritingTool(tool) ? paths.find((path) => isProtectedPath(root, path)) : undefined
  if (guarded !== undefined) {
    return denied(`${tool} may not touch ${guarded}: settings, hooks, deny list, guardrail files and .git are protected`)
  }
  if (evidenceWrite) {
    const evidenceRoot = resolve(root, EVIDENCE_FOLDER)
    return paths.every((path) => contains(evidenceRoot, path))
      ? { behavior: 'allow' }
      : denied(`${tool} is limited to ${EVIDENCE_FOLDER} in the ${phase} phase`)
  }
  if (isShellTool(tool)) {
    return { behavior: 'allow' }
  }
  return paths.every((path) => contains(root, path))
    ? { behavior: 'allow' }
    : denied(`${tool} may only touch files inside ${root}`)
}
