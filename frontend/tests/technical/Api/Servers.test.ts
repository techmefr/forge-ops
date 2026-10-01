import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  activateServer,
  activeServer,
  forgetVault,
  secureTokens,
  type TokenVault,
  addServer,
  readBook,
  rememberToken,
  removeServer,
  type ServerStorage,
} from '../../../src/technical/Api/Servers.js'

let data: Record<string, string>
let storage: ServerStorage

beforeEach(() => {
  data = {}
  storage = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
})

const VPS = { name: '', instanceUrl: 'https://vps.example.com', serverUrl: null }
const LAPTOP = { name: 'Laptop', instanceUrl: 'http://localhost:8830', serverUrl: null }

describe('server book', () => {
  it('est vide au depart', () => {
    expect(readBook(storage).servers).toEqual([])
    expect(activeServer(storage)).toBeNull()
  })

  it('nomme un serveur par son hote et l active', () => {
    const server = addServer(VPS, storage)
    expect(server.name).toBe('vps.example.com')
    expect(activeServer(storage)?.id).toBe(server.id)
  })

  it('ne duplique pas une adresse deja connue', () => {
    const first = addServer(VPS, storage)
    addServer(LAPTOP, storage)
    addServer(VPS, storage)
    expect(readBook(storage).servers).toHaveLength(2)
    expect(activeServer(storage)?.id).toBe(first.id)
  })

  it('passe d un serveur a l autre', () => {
    const first = addServer(VPS, storage)
    addServer(LAPTOP, storage)
    activateServer(first.id, storage)
    expect(activeServer(storage)?.id).toBe(first.id)
  })

  it('garde un jeton par serveur', () => {
    const first = addServer(VPS, storage)
    const second = addServer(LAPTOP, storage)
    rememberToken(first.id, 'abc', storage)
    expect(readBook(storage).servers.find((server) => server.id === first.id)?.token).toBe('abc')
    expect(readBook(storage).servers.find((server) => server.id === second.id)?.token).toBeNull()
  })

  it('bascule sur un autre serveur quand l actif est retire', () => {
    const first = addServer(VPS, storage)
    const second = addServer(LAPTOP, storage)
    removeServer(second.id, storage)
    expect(activeServer(storage)?.id).toBe(first.id)
    removeServer(first.id, storage)
    expect(activeServer(storage)).toBeNull()
  })

  it('ignore un stockage corrompu', () => {
    data['forge.servers'] = '{oops'
    expect(readBook(storage).servers).toEqual([])
  })
})

function memoryVault(options: { fails?: boolean } = {}): TokenVault & { saved: Map<string, string> } {
  const saved = new Map<string, string>()
  return {
    saved,
    get: async (id) => saved.get(id) ?? null,
    set: async (id, token) => {
      if (options.fails === true) {
        throw new Error('keychain locked')
      }
      saved.set(id, token)
    },
    remove: async (id) => {
      saved.delete(id)
    },
  }
}

describe('tokens in the keychain', () => {
  afterEach(() => {
    forgetVault()
  })

  it('moves a plaintext token to the vault and wipes it from storage', async () => {
    const server = addServer(VPS, storage)
    rememberToken(server.id, 'abc', storage)
    const vault = memoryVault()
    await secureTokens(storage, vault)
    expect(vault.saved.get(server.id)).toBe('abc')
    expect(data['forge.servers']).not.toContain('abc')
    expect(activeServer(storage)?.token).toBe('abc')
  })

  it('keeps the plaintext token when the vault refuses it, so nobody is signed out', async () => {
    const server = addServer(VPS, storage)
    rememberToken(server.id, 'abc', storage)
    await secureTokens(storage, memoryVault({ fails: true }))
    expect(activeServer(storage)?.token).toBe('abc')
    expect(data['forge.servers']).toContain('abc')
  })

  it('loads tokens already held by the vault', async () => {
    const server = addServer(VPS, storage)
    const vault = memoryVault()
    vault.saved.set(server.id, 'kept')
    await secureTokens(storage, vault)
    expect(activeServer(storage)?.token).toBe('kept')
  })

  it('stores a new token in the vault only', async () => {
    const vault = memoryVault()
    await secureTokens(storage, vault)
    const server = addServer(VPS, storage)
    rememberToken(server.id, 'fresh', storage)
    await Promise.resolve()
    expect(vault.saved.get(server.id)).toBe('fresh')
    expect(data['forge.servers']).not.toContain('fresh')
    expect(activeServer(storage)?.token).toBe('fresh')
  })

  it('clears the token from the vault on sign out and on removal', async () => {
    const vault = memoryVault()
    await secureTokens(storage, vault)
    const server = addServer(VPS, storage)
    rememberToken(server.id, 'fresh', storage)
    await Promise.resolve()
    rememberToken(server.id, null, storage)
    await Promise.resolve()
    expect(vault.saved.has(server.id)).toBe(false)
    rememberToken(server.id, 'again', storage)
    await Promise.resolve()
    removeServer(server.id, storage)
    await Promise.resolve()
    expect(vault.saved.has(server.id)).toBe(false)
  })
})
