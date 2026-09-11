import { describe, expect, it } from 'vitest'
import { requestFor } from '@/domain/Story/TicketRequest'

describe('requestFor', () => {
  it('demande de reecrire le titre', () => {
    expect(requestFor({ kind: 'title', text: 'Cartographie du depot' })).toEqual({
      key: 'ticket.askTitle',
      values: { said: 'Cartographie du depot' },
      count: null,
    })
  })

  it('demande de reecrire le corps', () => {
    expect(requestFor({ kind: 'body', text: 'montrer l architecture' }).key).toBe('ticket.askBody')
  })

  it('demande de revoir un critere', () => {
    expect(requestFor({ kind: 'criterion', text: 'une colonne vide' }).key).toBe(
      'ticket.askCriterion',
    )
  })

  it('demande de combler un manque', () => {
    expect(requestFor({ kind: 'gap', text: 'le corps ne dit pas assez' }).key).toBe('ticket.askGap')
  })

  it('demande la preuve d une etape', () => {
    expect(requestFor({ kind: 'step', text: 'Tests ecrits et rouges' }).key).toBe('ticket.askStep')
  })

  it('coupe un texte trop long pour rester lisible', () => {
    const long = 'a'.repeat(200)

    expect(requestFor({ kind: 'title', text: long }).values.said).toBe(`${'a'.repeat(120)}\u2026`)
  })

  it('laisse un texte court intact', () => {
    expect(requestFor({ kind: 'title', text: 'court' }).values.said).toBe('court')
  })
})
