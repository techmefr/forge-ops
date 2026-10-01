import { describe, expect, it } from 'vitest'
import { answerOfDeepLink, createDesktopHandoff, startUrlOf } from '../../../src/technical/Api/DesktopSignIn.js'

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

describe('startUrlOf with a challenge', () => {
  it('carries the challenge on a desktop start', () => {
    expect(startUrlOf('https://x.io', 'google', true, 'abc')).toBe(
      'https://x.io/api/auth/oidc/google/start?client=desktop&challenge=abc',
    )
  })

  it('ignores the challenge in a browser', () => {
    expect(startUrlOf('', 'google', false, 'abc')).toBe('/api/auth/oidc/google/start')
  })
})

describe('createDesktopHandoff', () => {
  it('ignores a deep link when no sign-in was started', () => {
    const handoff = createDesktopHandoff()
    expect(handoff.accept({ code: 'forged' })).toBeNull()
    expect(handoff.accept({ error: 'refused' })).toBeNull()
  })

  it('gives a challenge that matches the verifier it later hands back', async () => {
    const handoff = createDesktopHandoff()
    const challenge = await handoff.begin()
    const accepted = handoff.accept({ code: 'abc' })
    expect(accepted).toEqual({ code: 'abc', verifier: expect.any(String) })
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((accepted as { verifier: string }).verifier))
    expect(Buffer.from(digest).toString('base64url')).toBe(challenge)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('accepts a single answer per started sign-in', async () => {
    const handoff = createDesktopHandoff()
    await handoff.begin()
    expect(handoff.accept({ code: 'abc' })).not.toBeNull()
    expect(handoff.accept({ code: 'again' })).toBeNull()
  })

  it('lets a refusal through once and then closes', async () => {
    const handoff = createDesktopHandoff()
    await handoff.begin()
    expect(handoff.accept({ error: 'refused' })).toEqual({ error: 'refused' })
    expect(handoff.accept({ code: 'late' })).toBeNull()
  })

  it('uses a fresh verifier for each sign-in', async () => {
    const handoff = createDesktopHandoff()
    const first = await handoff.begin()
    const second = await handoff.begin()
    expect(first).not.toBe(second)
  })
})
