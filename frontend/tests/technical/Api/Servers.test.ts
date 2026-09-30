import { beforeEach, describe, expect, it } from 'vitest'
import {
  activateServer,
  activeServer,
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
