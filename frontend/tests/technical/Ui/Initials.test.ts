import { describe, expect, it } from 'vitest'
import { initialsOf, toneOf } from '@/technical/Ui/Initials'

describe('initialsOf', () => {
  it('takes the first letter of the first and last words', () => {
    expect(initialsOf('ana maria da silva')).toBe('AS')
    expect(initialsOf('Elena Vasquez')).toBe('EV')
  })

  it('keeps a single letter for a single word', () => {
    expect(initialsOf('Bob')).toBe('B')
  })

  it('splits logins on dots, dashes and underscores', () => {
    expect(initialsOf('marc.dubois')).toBe('MD')
    expect(initialsOf('sofia_rossi')).toBe('SR')
  })

  it('never returns an empty badge', () => {
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('toneOf', () => {
  it('gives the same tone to the same name', () => {
    expect(toneOf('Elena Vasquez')).toBe(toneOf('Elena Vasquez'))
  })

  it('spreads names over several tones', () => {
    const tones = new Set(['Elena', 'Marc', 'Sofia', 'Demo architect', 'Luca', 'Ana'].map(toneOf))
    expect(tones.size).toBeGreaterThan(1)
  })
})
