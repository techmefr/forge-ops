import { describe, expect, it } from 'vitest'
import { DESKS } from '@/domain/Story/Desk'

describe('DESKS', () => {
  it('couvre les deux plans de travail de l atelier', () => {
    expect([...DESKS]).toEqual(['write', 'reports'])
  })
})
