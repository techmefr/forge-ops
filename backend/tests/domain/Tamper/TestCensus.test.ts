import { describe, expect, it } from 'vitest'
import { censusOfSource, compareCensus } from '../../../src/domain/Tamper/TestCensus.js'

describe('censusOfSource', () => {
  it('compte les tests declares', () => {
    const source = [
      "it('fait une chose', () => { expect(valeur).toBe(1) })",
      "it('fait une autre chose', () => { expect(valeur).toBe(2) })",
    ].join('\n')

    expect(censusOfSource(source).tests).toBe(2)
  })

  it('compte aussi les tests ecrits avec test au lieu de it', () => {
    expect(censusOfSource("test('fait une chose', () => {})").tests).toBe(1)
  })

  it('ne compte pas un describe comme un test', () => {
    expect(censusOfSource("describe('un groupe', () => {})").tests).toBe(0)
  })

  it('ne compte pas le mot it au milieu d un identifiant', () => {
    expect(censusOfSource("const audit = () => {}\naudit('x', () => {})").tests).toBe(0)
  })

  it('releve un test mis de cote', () => {
    const source = ["it.skip('plus tard', () => {})", "it('maintenant', () => { expect(a).toBe(1) })"].join('\n')

    expect(censusOfSource(source)).toMatchObject({ tests: 2, skipped: 1 })
  })

  it('releve un test mis de cote a l ancienne', () => {
    expect(censusOfSource("xit('plus tard', () => {})").skipped).toBe(1)
  })

  it('releve un groupe entier mis de cote', () => {
    expect(censusOfSource("describe.skip('tout un pan', () => {})").skipped).toBe(1)
  })

  it('releve un test marque a faire', () => {
    expect(censusOfSource("it.todo('un jour')").skipped).toBe(1)
  })

  it('releve une assertion qui ne prouve rien', () => {
    expect(censusOfSource('expect(true).toBe(true)').tautologies).toBe(1)
  })

  it('releve une assertion qui se compare a elle-meme', () => {
    expect(censusOfSource('expect(total).toBe(total)').tautologies).toBe(1)
  })

  it('ne releve rien sur une assertion honnete', () => {
    expect(censusOfSource('expect(total).toBe(3)').tautologies).toBe(0)
  })

  it('ne releve pas une comparaison entre deux choses differentes', () => {
    expect(censusOfSource('expect(recu).toEqual(attendu)').tautologies).toBe(0)
  })

  it('releve une assertion vide de vrai', () => {
    expect(censusOfSource('expect(1).toBe(1)').tautologies).toBe(1)
  })
})

describe('compareCensus', () => {
  const honnete = { tests: 10, skipped: 0, tautologies: 0 }

  it('ne signale rien quand rien n a bouge', () => {
    expect(compareCensus(honnete, honnete)).toEqual([])
  })

  it('ne signale rien quand des tests ont ete ajoutes', () => {
    expect(compareCensus(honnete, { ...honnete, tests: 12 })).toEqual([])
  })

  it('signale des tests disparus', () => {
    const findings = compareCensus(honnete, { ...honnete, tests: 8 })

    expect(findings).toHaveLength(1)
    expect(findings[0]).toContain('2')
  })

  it('signale un test mis de cote apres coup', () => {
    expect(compareCensus(honnete, { ...honnete, skipped: 1 })).toHaveLength(1)
  })

  it('signale une assertion tautologique apparue apres coup', () => {
    expect(compareCensus(honnete, { ...honnete, tautologies: 1 })).toHaveLength(1)
  })

  it('signale les trois a la fois plutot que le premier seulement', () => {
    expect(compareCensus(honnete, { tests: 9, skipped: 2, tautologies: 1 })).toHaveLength(3)
  })

  it('ne pardonne pas un test remplace par un test mis de cote a nombre constant', () => {
    expect(compareCensus(honnete, { tests: 10, skipped: 1, tautologies: 0 })).toHaveLength(1)
  })
})
