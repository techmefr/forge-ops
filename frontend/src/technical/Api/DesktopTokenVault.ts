import type { TokenVault } from './Servers.js'

async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const desktopTokenVault: TokenVault = {
  get: (id) => call<string | null>('token_get', { id }),
  set: (id, token) => call<void>('token_set', { id, token }),
  remove: (id) => call<void>('token_delete', { id }),
}
