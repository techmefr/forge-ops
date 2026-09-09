import { describe, expect, it } from 'vitest'
import { usageOf } from '../../../src/technical/ClaudeCode/SdkSessionRunner.js'

describe('usageOf', () => {
  it('releve le cout total rendu par le sdk', () => {
    expect(usageOf({ type: 'result', total_cost_usd: 1.25 })).toEqual({ costUsd: 1.25 })
  })

  it('releve les jetons entrants et sortants', () => {
    expect(usageOf({ type: 'result', usage: { input_tokens: 100, output_tokens: 20 } })).toEqual({
      inputTokens: 100,
      outputTokens: 20,
    })
  })

  it('ne releve rien sur un message qui ne porte pas d usage', () => {
    expect(usageOf({ type: 'assistant' })).toEqual({})
  })

  it('ne casse pas sur un message qui n est pas un objet', () => {
    expect(usageOf('bruit')).toEqual({})
  })

  it('ne casse pas sur nul', () => {
    expect(usageOf(null)).toEqual({})
  })

  it('ignore un cout qui n est pas un nombre', () => {
    expect(usageOf({ total_cost_usd: 'beaucoup' })).toEqual({})
  })

  it('ignore des jetons qui ne sont pas des nombres', () => {
    expect(usageOf({ usage: { input_tokens: null, output_tokens: 5 } })).toEqual({ outputTokens: 5 })
  })
})
