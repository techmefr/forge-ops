import { describe, expect, it } from 'vitest'
import { DESKS } from '@/domain/Story/Desk'

describe('DESKS', () => {
  it('couvre les deux plans de travail de l atelier', () => {
    expect(DESKS.map((desk) => desk.key)).toEqual(['write', 'reports'])
  })

  it('explique a quoi sert chaque plan sans repeter son nom', () => {
    expect(
      DESKS.filter((desk) => desk.said === '' || desk.said.toLowerCase().includes(desk.label.toLowerCase())),
    ).toEqual([])
  })
})
