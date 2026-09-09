import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../../src/technical/Auth/PasswordHash.js'
import { PasswordUnhashableError } from '../../../src/technical/Auth/PasswordHash.js'

describe('hashPassword', () => {
  it('ne rend jamais le mot de passe en clair', () => {
    expect(hashPassword('un mot de passe assez long')).not.toContain('un mot de passe assez long')
  })

  it('rend un condensat different a chaque fois, grace au sel', () => {
    expect(hashPassword('un mot de passe assez long')).not.toBe(hashPassword('un mot de passe assez long'))
  })

  it('refuse un mot de passe trop court pour valoir quelque chose', () => {
    expect(() => hashPassword('court')).toThrow(PasswordUnhashableError)
  })

  it('refuse un mot de passe vide', () => {
    expect(() => hashPassword('')).toThrow(PasswordUnhashableError)
  })

  it('refuse un mot de passe absurdement long, pour ne pas se faire noyer au calcul', () => {
    expect(() => hashPassword('a'.repeat(2000))).toThrow(PasswordUnhashableError)
  })

  it('nomme l algorithme et ses parametres dans le condensat', () => {
    expect(hashPassword('un mot de passe assez long')).toMatch(/^scrypt\$/)
  })
})

describe('verifyPassword', () => {
  it('reconnait le bon mot de passe', () => {
    const stored = hashPassword('un mot de passe assez long')

    expect(verifyPassword('un mot de passe assez long', stored)).toBe(true)
  })

  it('rejette un mot de passe voisin', () => {
    const stored = hashPassword('un mot de passe assez long')

    expect(verifyPassword('un mot de passe assez longs', stored)).toBe(false)
  })

  it('rejette sans exploser sur un condensat abime', () => {
    expect(verifyPassword('un mot de passe assez long', 'nawak')).toBe(false)
  })

  it('rejette sans exploser sur un condensat vide', () => {
    expect(verifyPassword('un mot de passe assez long', '')).toBe(false)
  })

  it('rejette un condensat dont l algorithme n est pas celui qu on sait verifier', () => {
    expect(verifyPassword('un mot de passe assez long', 'md5$sel$condensat')).toBe(false)
  })

  it('rejette un mot de passe trop court sans lever, puisque la verification n est pas un reglage', () => {
    const stored = hashPassword('un mot de passe assez long')

    expect(verifyPassword('x', stored)).toBe(false)
  })
})
