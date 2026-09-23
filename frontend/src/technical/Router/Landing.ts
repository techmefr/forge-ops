import { HOME_PATH } from './Screen.js'

export const PERSONAL_HOME_PATH = '/me'

export async function resolveLandingPath(readProjects: () => Promise<unknown>): Promise<string> {
  try {
    const projects = await readProjects()
    if (Array.isArray(projects) && projects.length === 0) {
      return PERSONAL_HOME_PATH
    }
    return HOME_PATH
  } catch {
    return HOME_PATH
  }
}
