import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { censusOfTree } from '../../../src/technical/Tamper/TestTreeCensus.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'starfleet-tests-'))
  mkdirSync(join(root, 'domain'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('censusOfTree', () => {
  it('compte les tests de tout l arbre', () => {
    writeFileSync(join(root, 'une.test.ts'), "it('a', () => { expect(x).toBe(1) })")
    writeFileSync(join(root, 'domain', 'deux.test.ts'), "it('b', () => {})\nit('c', () => {})")

    expect(censusOfTree(root).tests).toBe(3)
  })

  it('ne lit que les fichiers de test', () => {
    writeFileSync(join(root, 'aide.ts'), "it('pas un test', () => {})")

    expect(censusOfTree(root).tests).toBe(0)
  })

  it('rend un recensement vide quand l arbre n existe pas', () => {
    expect(censusOfTree(join(root, 'absent'))).toEqual({ tests: 0, skipped: 0, tautologies: 0 })
  })

  it('additionne les tests mis de cote de plusieurs fichiers', () => {
    writeFileSync(join(root, 'une.test.ts'), "it.skip('a', () => {})")
    writeFileSync(join(root, 'domain', 'deux.test.ts'), "xit('b', () => {})")

    expect(censusOfTree(root).skipped).toBe(2)
  })

  it('ne compte pas deux fois un fichier atteint par un lien vers l arbre lui-meme', () => {
    writeFileSync(join(root, 'une.test.ts'), "it('a', () => {})")
    symlinkSync(root, join(root, 'domain', 'boucle'), 'dir')

    expect(censusOfTree(root).tests).toBe(1)
  })
})
