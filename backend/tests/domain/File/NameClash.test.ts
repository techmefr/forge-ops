import { describe, expect, it } from 'vitest'
import { clashesOf } from '../../../src/domain/File/NameClash.js'

describe('clashesOf', () => {
  it('ne signale rien quand chaque nom est unique', () => {
    expect(clashesOf(['frontend/src/domain/User/UserModal.vue', 'frontend/src/domain/User/UserRow.vue'])).toEqual(
      [],
    )
  })

  it('signale deux fichiers au meme nom dans deux dossiers', () => {
    expect(clashesOf(['frontend/src/domain/User/UserModal.vue', 'frontend/src/domain/Admin/UserModal.vue'])).toEqual(
      [
        {
          name: 'UserModal',
          paths: ['frontend/src/domain/Admin/UserModal.vue', 'frontend/src/domain/User/UserModal.vue'],
        },
      ],
    )
  })

  it('rapproche un nom au pluriel ou avec un e de trop', () => {
    expect(
      clashesOf(['frontend/src/domain/User/UserModale.vue', 'frontend/src/domain/Admin/UserModal.vue']).map(
        (clash) => clash.paths.length,
      ),
    ).toEqual([2])
  })

  it('ne confond pas un fichier avec son propre test', () => {
    expect(clashesOf(['backend/src/domain/File/FileMark.ts', 'backend/tests/domain/File/FileMark.test.ts'])).toEqual(
      [],
    )
  })

  it('ne compte pas deux fois le meme chemin', () => {
    expect(clashesOf(['a/UserModal.vue', 'a/UserModal.vue'])).toEqual([])
  })

  it('ne confond pas deux extensions differentes', () => {
    expect(clashesOf(['frontend/src/technical/Ui/Glyph.ts', 'frontend/src/technical/Ui/Glyph.vue'])).toEqual([])
  })

  it('ne regarde que les fichiers de code', () => {
    expect(clashesOf(['a/SKILL.md', 'b/SKILL.md'])).toEqual([])
  })

  it('ignore les noms d index sans identite propre', () => {
    expect(clashesOf(['a/index.ts', 'b/index.ts'])).toEqual([])
  })
})
