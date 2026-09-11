import { spawnSync } from 'node:child_process'

export function runQuietly(command: string, args: readonly string[], cwd: string): number {
  const finished = spawnSync(command, [...args], { cwd, encoding: 'utf-8', shell: false })
  if (finished.error !== undefined) {
    return 127
  }
  return finished.status ?? 1
}
