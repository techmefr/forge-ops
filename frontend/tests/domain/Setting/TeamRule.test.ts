import { describe, expect, it } from 'vitest'
import type { ProjectSheet } from '@contract/ProjectContract'
import {
  capacityFrom,
  initialsOf,
  mayChangeAdmin,
  positionAfterMove,
  usedBy,
} from '@/domain/Setting/TeamRule'

function sheet(overrides: Partial<ProjectSheet> = {}): ProjectSheet {
  return {
    id: 1,
    slug: 'alpha',
    name: 'Alpha',
    colour: '#112233',
    position: 0,
    adminUserId: 4,
    adminLogin: 'ana',
    adminName: 'Ana',
    links: [],
    usage: 0,
    ...overrides,
  }
}

describe('usedBy', () => {
  it('says nothing about an unused item', () => {
    expect(usedBy(0)).toBeNull()
  })

  it('counts the subjects that hold an item back', () => {
    expect(usedBy(3)).toEqual({ key: 'team.usedBy', values: {}, count: 3 })
  })
})

describe('mayChangeAdmin', () => {
  it('lets the current admin, a super admin and the local operator change it', () => {
    expect(mayChangeAdmin(sheet(), { login: 'ana', superAdmin: false })).toBe(true)
    expect(mayChangeAdmin(sheet(), { login: 'root', superAdmin: true })).toBe(true)
    expect(mayChangeAdmin(sheet(), { login: 'local', superAdmin: false })).toBe(true)
  })

  it('lets anyone name the first admin', () => {
    expect(mayChangeAdmin(sheet({ adminUserId: null, adminLogin: null }), { login: 'bob', superAdmin: false })).toBe(true)
  })

  it('refuses everyone else, and the unknown visitor', () => {
    expect(mayChangeAdmin(sheet(), { login: 'bob', superAdmin: false })).toBe(false)
    expect(mayChangeAdmin(sheet(), null)).toBe(false)
  })
})

describe('positionAfterMove', () => {
  it('moves one step and stops at both ends', () => {
    expect(positionAfterMove(1, -1, 3)).toBe(0)
    expect(positionAfterMove(1, 1, 3)).toBe(2)
    expect(positionAfterMove(0, -1, 3)).toBeNull()
    expect(positionAfterMove(2, 1, 3)).toBeNull()
  })
})

describe('capacityFrom', () => {
  it('reads an empty field as no limit', () => {
    expect(capacityFrom('  ')).toBeNull()
  })

  it('reads a whole number in range', () => {
    expect(capacityFrom('4')).toBe(4)
    expect(capacityFrom('99')).toBe(99)
  })

  it.each(['0', '100', '-2', '2.5', 'abc'])('refuses %s', (text) => {
    expect(capacityFrom(text)).toBe('refused')
  })
})

describe('initialsOf', () => {
  it('keeps the first letters of the first two words', () => {
    expect(initialsOf('ana maria da silva')).toBe('AM')
    expect(initialsOf('Bob')).toBe('B')
  })
})
