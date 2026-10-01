const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '::1', '[::1]']

export const ALLOW_REMOTE_LOCAL_ENV = 'FORGE_ALLOW_REMOTE_LOCAL'

export function assertLocalModeBinding(mode: string, host: string, override: string | undefined): void {
  if (mode !== 'local' || LOOPBACK_HOSTS.includes(host) || override === 'true') {
    return
  }
  throw new Error(
    `Local mode refuses to listen on ${host}: it would hand a full session to any reachable client. Bind to 127.0.0.1, or set ${ALLOW_REMOTE_LOCAL_ENV}=true when the port is only published on the loopback.`,
  )
}
