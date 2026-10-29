import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'

export function isCommandInstalled(command: string, pathValue: string | undefined): boolean {
  const directories = (pathValue ?? '').split(delimiter).filter((directory) => directory !== '')
  return directories.some((directory) => {
    try {
      accessSync(join(directory, command), constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}
