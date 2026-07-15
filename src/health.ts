import { Socket } from 'node:net'

const DEFAULT_TIMEOUT_MS = 400

/**
 * Teste si un port ecoute (une worktree "tourne" vraiment) en ouvrant une
 * connexion TCP courte. Cote serveur : le navigateur ne peut pas sonder des
 * ports arbitraires.
 */
export function isPortListening(
  port: number,
  host = '127.0.0.1',
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket()
    let settled = false
    const done = (result: boolean): void => {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}
