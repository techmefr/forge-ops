import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useForgeBoard } from '@/domain/Forge/UseForgeBoard'

const read = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: { read: (...args: unknown[]) => read(...args), send: vi.fn() },
}))

type Deferred = { promise: Promise<unknown>; resolve: (value: unknown) => void }

function deferred(): Deferred {
  let resolve: (value: unknown) => void = () => undefined
  const promise = new Promise<unknown>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function answers(subjectsOf: Record<number, Promise<unknown>>): void {
  read.mockImplementation((url: string) => {
    const project = Number(/projects\/(\d+)\//.exec(url)?.[1] ?? /project=(\d+)/.exec(url)?.[1])
    if (url.endsWith('/workflows')) {
      return Promise.resolve({ workflows: [] })
    }
    if (url.endsWith('/epics')) {
      return subjectsOf[project] ?? Promise.resolve([])
    }
    if (url.includes('workflow-columns')) {
      return Promise.resolve({ columns: [] })
    }
    return Promise.resolve([])
  })
}

beforeEach(() => {
  read.mockReset()
})

describe('useForgeBoard load', () => {
  it('keeps the subjects of the latest project when an older load answers last', async () => {
    const slow = deferred()
    answers({ 1: slow.promise, 2: Promise.resolve([{ id: 20 }]) })
    const project = ref<number | null>(1)
    const forge = useForgeBoard(() => project.value)

    const first = forge.load()
    project.value = 2
    const second = forge.load()
    await second
    slow.resolve([{ id: 10 }])
    await first

    expect(forge.subjects.value).toEqual([{ id: 20 }])
    expect(forge.pending.value).toBe(false)
  })

  it('does not leave the board pending when the project goes away during a load', async () => {
    const slow = deferred()
    answers({ 1: slow.promise })
    const project = ref<number | null>(1)
    const forge = useForgeBoard(() => project.value)

    const first = forge.load()
    project.value = null
    await forge.load()
    slow.resolve([{ id: 10 }])
    await first

    expect(forge.subjects.value).toEqual([])
    expect(forge.pending.value).toBe(false)
  })
})
