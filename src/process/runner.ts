import { spawn } from 'node:child_process'

export interface IStartResult {
  pid: number | null
  detail: string
}

/**
 * Lance le serveur d'une worktree en injectant son port (variable PORT).
 * Process detache dans son propre groupe : starfleet garde le PID pour
 * pouvoir le tuer ensuite, sans bloquer le serveur MCP.
 */
export function startServer(
  runCommand: string,
  port: number,
  cwd: string | null,
): IStartResult {
  try {
    const child = spawn(runCommand, {
      cwd: cwd ?? undefined,
      env: { ...process.env, PORT: String(port) },
      shell: true,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    if (child.pid === undefined) {
      return { pid: null, detail: 'Process lance mais PID indisponible' }
    }
    return { pid: child.pid, detail: `Serveur lance (pid ${child.pid}) sur le port ${port}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { pid: null, detail: `Echec du lancement: ${message}` }
  }
}

/**
 * Tue le groupe de process (kill sur `-pid`, car detached cree un nouveau
 * groupe) pour ne pas laisser d'enfants orphelins.
 */
export function stopServer(pid: number): { stopped: boolean; detail: string } {
  try {
    process.kill(-pid, 'SIGTERM')
    return { stopped: true, detail: `Serveur arrete (groupe ${pid})` }
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
      return { stopped: true, detail: `Serveur arrete (pid ${pid})` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { stopped: false, detail: `Echec de l'arret: ${message}` }
    }
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
