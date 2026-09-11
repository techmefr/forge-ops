import { describe, expect, it } from 'vitest'
import { saidKeyOf, saidOf, whoOf } from '@/domain/File/FileSaid'

const translate = (key: string, values: Readonly<Record<string, string | number>>, count: number) =>
  `${key}|${values.who}|${values.agent}|${count}`

describe('saidKeyOf', () => {
  it('se tait sur un fichier que personne ne touche', () => {
    expect(saidKeyOf({ mark: 'quiet', byReferences: [], agentName: null })).toBeNull()
  })

  it('nomme la session quand une seule story travaille dessus', () => {
    expect(saidKeyOf({ mark: 'planned', byReferences: ['FORGE-1'], agentName: 'neo' })).toBe(
      'fileSaid.plannedBy',
    )
  })

  it('tait la session des que plusieurs stories y touchent', () => {
    expect(
      saidKeyOf({ mark: 'planned', byReferences: ['FORGE-1', 'MAILER-2'], agentName: 'neo' }),
    ).toBe('fileSaid.planned')
  })

  it('ne nomme jamais de session sur un fichier deja livre', () => {
    expect(saidKeyOf({ mark: 'merged', byReferences: ['FORGE-1'], agentName: 'neo' })).toBe(
      'fileSaid.merged',
    )
  })
})

describe('whoOf', () => {
  it('enumere les stories dans la langue du lecteur', () => {
    expect(whoOf(['FORGE-1', 'MAILER-2'], 'fr')).toBe('FORGE-1 et MAILER-2')
  })

  it('change de liaison en anglais', () => {
    expect(whoOf(['FORGE-1', 'MAILER-2'], 'en')).toBe('FORGE-1 and MAILER-2')
  })
})

describe('saidOf', () => {
  it('passe le nombre de stories pour que le pluriel tienne', () => {
    expect(
      saidOf({ mark: 'ready', byReferences: ['A', 'B'], agentName: null }, 'en', translate),
    ).toBe('fileSaid.ready|A and B||2')
  })

  it('rend une chaine vide pour un fichier calme', () => {
    expect(saidOf({ mark: 'quiet', byReferences: [], agentName: null }, 'fr', translate)).toBe('')
  })
})
