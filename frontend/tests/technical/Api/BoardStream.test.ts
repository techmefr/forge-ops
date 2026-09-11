import { describe, expect, it } from 'vitest'
import { openBoardStream, parseFrame, type StreamedEvent } from '../../../src/technical/Api/BoardStream.js'

class FakeSource {
  readonly listeners = new Map<string, ((event: unknown) => void)[]>()
  closed = false

  addEventListener(name: string, listener: (event: unknown) => void): void {
    const bucket = this.listeners.get(name) ?? []
    bucket.push(listener)
    this.listeners.set(name, bucket)
  }

  close(): void {
    this.closed = true
  }

  emit(name: string, data: string): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener({ data })
    }
  }
}

function open(): { source: FakeSource; seen: StreamedEvent[]; errors: string[]; handle: { close: () => void } } {
  const source = new FakeSource()
  const seen: StreamedEvent[] = []
  const errors: string[] = []
  const handle = openBoardStream({
    onEvent: (event) => seen.push(event),
    onError: (reason) => errors.push(reason),
    source: () => source as unknown as EventSource,
  })
  return { source, seen, errors, handle }
}

describe('parseFrame', () => {
  it('decode une trame json', () => {
    expect(parseFrame('story.written', '{"id":1}')).toEqual({ name: 'story.written', payload: { id: 1 } })
  })

  it('ecarte une trame qui n est pas du json', () => {
    expect(parseFrame('story.written', 'nawak')).toBeNull()
  })

  it('ecarte une trame qui n est pas un objet', () => {
    expect(parseFrame('story.written', '42')).toBeNull()
  })

  it('ecarte une trame nulle', () => {
    expect(parseFrame('story.written', 'null')).toBeNull()
  })
})

describe('openBoardStream', () => {
  it('remonte un evenement de story', () => {
    const { source, seen } = open()

    source.emit('story.written', '{"reference":"FORGE-1"}')

    expect(seen).toEqual([{ name: 'story.written', payload: { reference: 'FORGE-1' } }])
  })

  it('remonte un incident', () => {
    const { source, seen } = open()

    source.emit('incident.reported', '{"id":7}')

    expect(seen[0]?.name).toBe('incident.reported')
  })

  it('ne remonte rien sur une trame abimee', () => {
    const { source, seen } = open()

    source.emit('story.written', 'nawak')

    expect(seen).toEqual([])
  })

  it('signale la coupure du flux', () => {
    const { source, errors } = open()

    source.emit('error', '')

    expect(errors).toEqual(['le flux du board est coupe'])
  })

  it('ferme le flux quand on le lui demande', () => {
    const { source, handle } = open()

    handle.close()

    expect(source.closed).toBe(true)
  })

  it('remonte ce que l agent a dit, sinon l ecran de story reste muet', () => {
    const { source, seen } = open()

    source.emit('session.assistant', '{"text":"je propose trois stories"}')

    expect(seen[0]?.payload.text).toBe('je propose trois stories')
  })

  it('remonte une porte humaine restee ouverte trop longtemps', () => {
    const { source, seen } = open()

    source.emit('story.gate_overdue', '{"reference":"FORGE-3","waitingHours":30}')

    expect(seen[0]?.payload.reference).toBe('FORGE-3')
  })

  it('n ecoute pas un evenement qui ne le concerne pas', () => {
    const { source, seen } = open()

    source.emit('nawak.inconnu', '{"x":1}')

    expect(seen).toEqual([])
  })
})
