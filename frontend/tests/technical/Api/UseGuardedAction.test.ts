import { describe, expect, it, vi } from 'vitest'
import { useGuardedAction } from '@/technical/Api/UseGuardedAction'

describe('useGuardedAction', () => {
  it('runs the action, then the follow-up, and reports success', async () => {
    const afterSuccess = vi.fn()
    const { attempt: guard, busy, refusal } = useGuardedAction(afterSuccess)
    const action = vi.fn().mockResolvedValue(undefined)

    expect(await guard(action)).toBe(true)
    expect(action).toHaveBeenCalledOnce()
    expect(afterSuccess).toHaveBeenCalledOnce()
    expect(busy.value).toBe(false)
    expect(refusal.value).toBeNull()
  })

  it('keeps the failure as a refusal and skips the follow-up', async () => {
    const afterSuccess = vi.fn()
    const { attempt: guard, busy, refusal } = useGuardedAction(afterSuccess)

    expect(await guard(() => Promise.reject(new Error('nope')))).toBe(false)
    expect(afterSuccess).not.toHaveBeenCalled()
    expect(busy.value).toBe(false)
    expect(refusal.value).not.toBeNull()
  })

  it('is busy while the action runs and clears an older refusal first', async () => {
    const { attempt: guard, busy, refusal } = useGuardedAction()
    await guard(() => Promise.reject(new Error('first')))
    let release: () => void = () => undefined
    const running = guard(() => new Promise<void>((done) => (release = done)))

    expect(busy.value).toBe(true)
    expect(refusal.value).toBeNull()
    release()
    await running
    expect(busy.value).toBe(false)
  })

  it('turns a failing follow-up into a refusal', async () => {
    const { attempt: guard, refusal } = useGuardedAction(() => Promise.reject(new Error('reload failed')))

    expect(await guard(() => Promise.resolve())).toBe(false)
    expect(refusal.value).not.toBeNull()
  })
})
