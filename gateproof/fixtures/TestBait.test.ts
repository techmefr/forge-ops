import { expect, it } from 'vitest'

it('fails on purpose so the gate proof can observe a red test', () => {
  expect(1 + 1).toBe(3)
})
