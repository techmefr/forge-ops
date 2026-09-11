import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { listDirectory, readTextFile, walkPaths } from '../../../src/technical/Repository/LocalTree.js'
import { PathOutsideCheckoutError } from '../../../src/technical/Repository/LocalTreeViolation.js'

let root = ''

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'forge-tree-'))
  mkdirSync(join(root, 'src', 'domain'), { recursive: true })
  mkdirSync(join(root, 'node_modules', 'left'), { recursive: true })
  mkdirSync(join(root, '.git'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{}')
  writeFileSync(join(root, 'src', 'domain', 'Story.ts'), 'export const story = 1\n')
  writeFileSync(join(root, 'node_modules', 'left', 'index.js'), 'nope')
})

describe('listDirectory', () => {
  it('rend les dossiers avant les fichiers, sans le bruit du depot', async () => {
    expect(await listDirectory(root, '')).toEqual([
      { path: 'src', name: 'src', kind: 'directory', bytes: null },
      { path: 'package.json', name: 'package.json', kind: 'file', bytes: 2 },
    ])
  })

  it('descend dans un sous dossier', async () => {
    expect((await listDirectory(root, 'src/domain')).map((entry) => entry.path)).toEqual([
      'src/domain/Story.ts',
    ])
  })

  it('refuse de sortir du depot', async () => {
    await expect(listDirectory(root, '../..')).rejects.toThrow(PathOutsideCheckoutError)
  })
})

describe('readTextFile', () => {
  it('rend le contenu et sa taille', async () => {
    expect(await readTextFile(root, 'src/domain/Story.ts', 1000)).toEqual({
      path: 'src/domain/Story.ts',
      text: 'export const story = 1\n',
      bytes: 23,
      truncated: false,
    })
  })

  it('coupe un fichier trop gros et le dit', async () => {
    const reading = await readTextFile(root, 'src/domain/Story.ts', 6)
    expect(reading.truncated).toBe(true)
    expect(reading.text).toBe('export')
  })

  it('refuse de sortir du depot', async () => {
    await expect(readTextFile(root, '../../etc/passwd', 10)).rejects.toThrow(PathOutsideCheckoutError)
  })
})

describe('walkPaths', () => {
  it('rend tous les chemins de fichiers, dossiers d abord', async () => {
    expect(await walkPaths(root, 50)).toEqual(['src/domain/Story.ts', 'package.json'])
  })

  it('s arrete au plafond demande', async () => {
    expect((await walkPaths(root, 1)).length).toBe(1)
  })
})
