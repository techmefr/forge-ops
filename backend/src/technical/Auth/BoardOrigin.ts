const LOOPBACK_NAMES: readonly string[] = ['127.0.0.1', 'localhost', 'forge.localhost', '::1', '[::1]']

export const DEV_SERVER_PORT = 8832

export function boardOrigins(host: string, port: number, publicOrigin: string | null = null): readonly string[] {
  const hosts = LOOPBACK_NAMES.includes(host) ? ['127.0.0.1', 'localhost', 'forge.localhost'] : [host]
  const origins = [
    ...hosts.map((name) => `http://${name}:${port}`),
    `http://127.0.0.1:${DEV_SERVER_PORT}`,
    `http://localhost:${DEV_SERVER_PORT}`,
    `http://forge.localhost:${DEV_SERVER_PORT}`,
    ...(publicOrigin === null ? [] : [publicOrigin]),
  ]
  return [...new Set(origins)]
}

export function isLocalOrigin(origin: string | null | undefined, host: string, port: number): boolean {
  if (origin === null || origin === undefined) {
    return true
  }
  return boardOrigins(host, port).includes(origin)
}
