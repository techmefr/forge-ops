import { describe, expect, it } from 'vitest'
import { BoardRequestError } from '../../../src/technical/Api/BoardClient.js'
import { reasonOf, useResource } from '../../../src/technical/Api/UseResource.js'

describe('reasonOf', () => {
  it('reprend le message du board, pour que l ecran dise pourquoi', () => {
    expect(
      reasonOf(new BoardRequestError(409, 'TwinRequiredError', 'il manque la jumelle')).key,
    ).toBe('il manque la jumelle')
  })

  it('reprend le message d une panne quelconque', () => {
    expect(reasonOf(new Error('reseau coupe')).key).toBe('reseau coupe')
  })

  it('reste lisible sur une panne sans message', () => {
    expect(reasonOf('nawak').key).toBe('common.boardSilent')
  })
})

describe('useResource', () => {
  it('n a rien avant le premier chargement', () => {
    const resource = useResource(() => Promise.resolve(1))

    expect(resource.data.value).toBeNull()
    expect(resource.pending.value).toBe(false)
  })

  it('expose la donnee chargee', async () => {
    const resource = useResource(() => Promise.resolve({ slug: 'forge' }))

    await resource.reload()

    expect(resource.data.value).toEqual({ slug: 'forge' })
  })

  it('retombe le drapeau d attente meme en cas de panne', async () => {
    const resource = useResource(() => Promise.reject(new Error('coupe')))

    await resource.reload()

    expect(resource.pending.value).toBe(false)
    expect(resource.failure.value?.key).toBe('coupe')
  })

  it('leve le drapeau d attente pendant le chargement', async () => {
    let seen = false
    const resource = useResource(() => {
      seen = resource.pending.value
      return Promise.resolve(1)
    })

    await resource.reload()

    expect(seen).toBe(true)
  })

  it('efface la panne precedente au rechargement', async () => {
    let broken = true
    const resource = useResource(() => (broken ? Promise.reject(new Error('coupe')) : Promise.resolve(2)))

    await resource.reload()
    broken = false
    await resource.reload()

    expect(resource.failure.value).toBeNull()
    expect(resource.data.value).toBe(2)
  })
})
