import { describe, expect, it } from 'vitest'
import { COMPLETENESS_FLOOR, scoreCompleteness } from '../../../src/domain/Story/Completeness.js'

const RICHE = {
  title: 'Visualiser la liste des mails du client',
  body: [
    "En tant que gestionnaire, je veux voir la liste des mails d'un client",
    'afin de retrouver un echange sans ouvrir sa boite.',
    '',
    'La liste est paginee par vingt, triee du plus recent au plus ancien.',
    "Un mail supprime cote fournisseur n'apparait plus.",
    'Quand le client n a aucun mail, la page le dit plutot que de rester vide.',
  ].join('\n'),
  criteria: ['AC-1', 'AC-2', 'AC-3'],
  hasTwin: true,
}

describe('scoreCompleteness', () => {
  it('donne un score plein a une story complete', () => {
    expect(scoreCompleteness(RICHE).score).toBe(100)
  })

  it('juge lancable une story complete', () => {
    expect(scoreCompleteness(RICHE).launchable).toBe(true)
  })

  it('enfonce le score d une story sans corps', () => {
    expect(scoreCompleteness({ ...RICHE, body: '' }).score).toBeLessThan(COMPLETENESS_FLOOR)
  })

  it('enfonce le score d une story sans critere', () => {
    expect(scoreCompleteness({ ...RICHE, criteria: [] }).score).toBeLessThan(COMPLETENESS_FLOOR)
  })

  it('juge non lancable ce qui passe sous le plancher', () => {
    expect(scoreCompleteness({ title: 'x', body: '', criteria: [], hasTwin: false }).launchable).toBe(false)
  })

  it('dit pourquoi le score est bas plutot que de rendre un chiffre seul', () => {
    const verdict = scoreCompleteness({ ...RICHE, criteria: [] })

    expect(verdict.gaps.join(' ')).toMatch(/critere/)
  })

  it('ne signale aucun manque sur une story complete', () => {
    expect(scoreCompleteness(RICHE).gaps).toEqual([])
  })

  it('reproche l absence de story jumelle', () => {
    expect(scoreCompleteness({ ...RICHE, hasTwin: false }).gaps.join(' ')).toMatch(/jumelle/)
  })

  it('reproche un titre trop court pour dire quoi que ce soit', () => {
    expect(scoreCompleteness({ ...RICHE, title: 'mails' }).gaps.join(' ')).toMatch(/titre/)
  })

  it('reproche un corps qui ne dit ni le besoin ni le pourquoi', () => {
    const verdict = scoreCompleteness({ ...RICHE, body: 'faire les mails' })

    expect(verdict.gaps.length).toBeGreaterThan(0)
  })

  it('ne descend jamais sous zero', () => {
    expect(scoreCompleteness({ title: '', body: '', criteria: [], hasTwin: false }).score).toBeGreaterThanOrEqual(0)
  })

  it('ne depasse jamais cent, meme sur une story bavarde', () => {
    const verdict = scoreCompleteness({
      ...RICHE,
      body: RICHE.body.repeat(20),
      criteria: ['AC-1', 'AC-2', 'AC-3', 'AC-4', 'AC-5', 'AC-6', 'AC-7', 'AC-8'],
    })

    expect(verdict.score).toBeLessThanOrEqual(100)
  })

  it('place le plancher a soixante, comme la doctrine le dit', () => {
    expect(COMPLETENESS_FLOOR).toBe(60)
  })

  it('juge lancable pile au plancher', () => {
    const verdict = scoreCompleteness(RICHE)

    expect(verdict.launchable).toBe(verdict.score >= COMPLETENESS_FLOOR)
  })
})
