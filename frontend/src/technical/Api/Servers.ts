export type Server = {
  id: string
  name: string
  instanceUrl: string
  serverUrl: string | null
  token: string | null
}

export type ServerBook = {
  servers: Server[]
  activeId: string | null
}

export type ServerStorage = Pick<Storage, 'getItem' | 'setItem'>

export type TokenVault = {
  get(id: string): Promise<string | null>
  set(id: string, token: string): Promise<void>
  remove(id: string): Promise<void>
}

export const SERVERS_KEY = 'forge.servers'

const EMPTY: ServerBook = { servers: [], activeId: null }

let vault: TokenVault | null = null
const vaulted = new Map<string, string>()

function isServer(value: unknown): value is Server {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.instanceUrl === 'string' &&
    (record.serverUrl === null || typeof record.serverUrl === 'string') &&
    (record.token === null || typeof record.token === 'string')
  )
}

function defaultStorage(): ServerStorage {
  return window.localStorage
}

export function readBook(storage: ServerStorage = defaultStorage()): ServerBook {
  try {
    const parsed = JSON.parse(storage.getItem(SERVERS_KEY) ?? 'null') as Record<string, unknown> | null
    if (parsed === null || !Array.isArray(parsed.servers)) {
      return EMPTY
    }
    const servers = parsed.servers.filter(isServer).map((server) => ({ ...server, token: vaulted.get(server.id) ?? server.token }))
    const activeId = typeof parsed.activeId === 'string' ? parsed.activeId : null
    return { servers, activeId: servers.some((server) => server.id === activeId) ? activeId : null }
  } catch {
    return EMPTY
  }
}

function writeBook(book: ServerBook, storage: ServerStorage): ServerBook {
  const stored = book.servers.map((server) => ({ ...server, token: vaulted.has(server.id) ? null : server.token }))
  storage.setItem(SERVERS_KEY, JSON.stringify({ ...book, servers: stored }))
  return book
}

export function forgetVault(): void {
  vault = null
  vaulted.clear()
}

export async function secureTokens(storage: ServerStorage, tokenVault: TokenVault): Promise<void> {
  forgetVault()
  vault = tokenVault
  const book = readBook(storage)
  for (const server of book.servers) {
    try {
      const token = server.token ?? (await tokenVault.get(server.id))
      if (token === null) {
        continue
      }
      if (server.token !== null) {
        await tokenVault.set(server.id, token)
      }
      vaulted.set(server.id, token)
    } catch {
      continue
    }
  }
  writeBook(book, storage)
}

export function activeServer(storage: ServerStorage = defaultStorage()): Server | null {
  const book = readBook(storage)
  return book.servers.find((server) => server.id === book.activeId) ?? null
}

export function nameOf(instanceUrl: string): string {
  try {
    return new URL(instanceUrl).host
  } catch {
    return instanceUrl
  }
}

export function addServer(
  draft: { name: string; instanceUrl: string; serverUrl: string | null },
  storage: ServerStorage = defaultStorage(),
): Server {
  const book = readBook(storage)
  const existing = book.servers.find((server) => server.instanceUrl === draft.instanceUrl)
  if (existing !== undefined) {
    writeBook({ ...book, activeId: existing.id }, storage)
    return existing
  }
  const server: Server = {
    id: crypto.randomUUID(),
    name: draft.name.trim() === '' ? nameOf(draft.instanceUrl) : draft.name.trim(),
    instanceUrl: draft.instanceUrl,
    serverUrl: draft.serverUrl,
    token: null,
  }
  writeBook({ servers: [...book.servers, server], activeId: server.id }, storage)
  return server
}

export function activateServer(id: string, storage: ServerStorage = defaultStorage()): void {
  const book = readBook(storage)
  if (book.servers.some((server) => server.id === id)) {
    writeBook({ ...book, activeId: id }, storage)
  }
}

export function removeServer(id: string, storage: ServerStorage = defaultStorage()): ServerBook {
  const book = readBook(storage)
  const servers = book.servers.filter((server) => server.id !== id)
  vaulted.delete(id)
  void vault?.remove(id).catch(() => undefined)
  const activeId = book.activeId === id ? (servers[0]?.id ?? null) : book.activeId
  return writeBook({ servers, activeId }, storage)
}

export function rememberToken(
  id: string,
  token: string | null,
  storage: ServerStorage = defaultStorage(),
): void {
  const book = readBook(storage)
  const update = (value: string | null): void => {
    writeBook(
      {
        ...book,
        servers: book.servers.map((server) => (server.id === id ? { ...server, token: value } : server)),
      },
      storage,
    )
  }
  if (vault === null) {
    update(token)
    return
  }
  if (token === null) {
    vaulted.delete(id)
    update(null)
    void vault.remove(id).catch(() => undefined)
    return
  }
  vaulted.set(id, token)
  update(token)
  void vault.set(id, token).catch(() => {
    vaulted.delete(id)
    update(token)
  })
}
