import { describe, expect, it } from 'vitest'
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  frenchPluralIndex,
  isLanguage,
  negotiateLanguage,
} from '@/technical/Language/Language'

describe('les langues proposees', () => {
  it('en propose six', () => {
    expect([...LANGUAGES]).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt'])
  })

  it('reconnait une langue du lot', () => {
    expect(isLanguage('pt')).toBe(true)
  })

  it('refuse une langue hors du lot', () => {
    expect(isLanguage('nl')).toBe(false)
  })
})

describe('negotiateLanguage', () => {
  it('prend la premiere langue du navigateur que le board parle', () => {
    expect(negotiateLanguage(['nl-NL', 'de-AT', 'en'])).toBe('de')
  })

  it('ignore la region du marqueur', () => {
    expect(negotiateLanguage(['PT-BR'])).toBe('pt')
  })

  it('retombe sur l anglais quand rien ne correspond', () => {
    expect(negotiateLanguage(['nl', 'sv'])).toBe(FALLBACK_LANGUAGE)
  })

  it('retombe sur l anglais sans aucune preference', () => {
    expect(negotiateLanguage([])).toBe('en')
  })
})

describe('frenchPluralIndex', () => {
  it('garde le singulier a zero, comme le francais le veut', () => {
    expect(frenchPluralIndex(0, 2)).toBe(0)
  })

  it('garde le singulier a un', () => {
    expect(frenchPluralIndex(1, 2)).toBe(0)
  })

  it('passe au pluriel a deux', () => {
    expect(frenchPluralIndex(2, 2)).toBe(1)
  })

  it('ne sort jamais du nombre de formes offertes', () => {
    expect(frenchPluralIndex(7, 1)).toBe(0)
  })
})
