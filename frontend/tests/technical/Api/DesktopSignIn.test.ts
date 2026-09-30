import { describe, expect, it } from 'vitest'
import { answerOfDeepLink, startUrlOf } from '../../../src/technical/Api/DesktopSignIn.js'

describe('answerOfDeepLink', () => {
  it('lit le code de retour', () => {
    expect(answerOfDeepLink('forgeops://auth?code=abc')).toEqual({ code: 'abc' })
  })

  it('lit un refus', () => {
    expect(answerOfDeepLink('forgeops://auth?error=refused')).toEqual({ error: 'refused' })
  })

  it('ignore les autres liens', () => {
    expect(answerOfDeepLink('https://evil.example/auth?code=abc')).toBeNull()
    expect(answerOfDeepLink('forgeops://other?code=abc')).toBeNull()
    expect(answerOfDeepLink('not a url')).toBeNull()
  })
})

describe('startUrlOf', () => {
  it('marque le client desktop', () => {
    expect(startUrlOf('https://x.io', 'google', true)).toBe('https://x.io/api/auth/oidc/google/start?client=desktop')
    expect(startUrlOf('', 'google', false)).toBe('/api/auth/oidc/google/start')
  })
})
