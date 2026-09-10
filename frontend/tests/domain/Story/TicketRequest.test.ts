import { describe, expect, it } from 'vitest'
import { requestFor } from '@/domain/Story/TicketRequest'

describe('requestFor', () => {
  it('demande de reecrire le titre', () => {
    expect(requestFor({ kind: 'title', text: 'Cartographie du depot' })).toBe(
      'Reecris le titre de la story, aujourd hui « Cartographie du depot » : ',
    )
  })

  it('demande de reecrire le corps', () => {
    expect(requestFor({ kind: 'body', text: 'montrer l architecture' })).toBe(
      'Reecris le corps de la story, aujourd hui « montrer l architecture » : ',
    )
  })

  it('demande de revoir un critere', () => {
    expect(requestFor({ kind: 'criterion', text: 'une colonne vide reste affichee' })).toBe(
      'Revois le critere « une colonne vide reste affichee » : ',
    )
  })

  it('demande de combler un manque', () => {
    expect(requestFor({ kind: 'gap', text: 'le corps ne dit pas assez pour etre code' })).toBe(
      'Comble ce manque : le corps ne dit pas assez pour etre code. ',
    )
  })

  it('demande la preuve d une etape', () => {
    expect(requestFor({ kind: 'step', text: 'Tests ecrits et rouges' })).toBe(
      'Dis-moi ce qui manque pour prouver « Tests ecrits et rouges » : ',
    )
  })

  it('coupe un texte trop long pour rester lisible', () => {
    const long = 'a'.repeat(200)

    expect(requestFor({ kind: 'title', text: long })).toContain(`${'a'.repeat(120)}…`)
  })

  it('laisse un texte court intact', () => {
    expect(requestFor({ kind: 'title', text: 'court' })).toContain('« court »')
  })
})
