import { describe, expect, it } from 'vitest'
import { recommendModel } from '../src/router/modelRouter.js'

describe('recommendModel', () => {
  it('recommends opus for architecture-heavy steps', () => {
    expect(recommendModel('SPEC').recommendedModel).toBe('opus')
    expect(recommendModel('CODE-SIMPLIFY').recommendedModel).toBe('opus')
  })

  it('recommends sonnet for standard dev steps', () => {
    expect(recommendModel('PLAN').recommendedModel).toBe('sonnet')
    expect(recommendModel('BUILD').recommendedModel).toBe('sonnet')
    expect(recommendModel('TEST').recommendedModel).toBe('sonnet')
  })

  it('recommends haiku for mechanical tasks', () => {
    expect(recommendModel('mechanical').recommendedModel).toBe('haiku')
  })

  it('recommends fable for creative tasks', () => {
    expect(recommendModel('creative').recommendedModel).toBe('fable')
  })
})
