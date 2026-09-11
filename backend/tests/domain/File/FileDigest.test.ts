import { describe, expect, it } from 'vitest'
import { describeFile } from '../../../src/domain/File/FileDigest.js'

describe('describeFile', () => {
  it('reconnait un repository de domaine', () => {
    expect(describeFile('backend/src/domain/Story/StoryRepository.ts')).toBe(
      'Acces base de donnees des stories',
    )
  })

  it('reconnait une api de domaine', () => {
    expect(describeFile('backend/src/domain/Story/StoryApi.ts')).toBe('Routes http des stories')
  })

  it('reconnait un ecran et un composant vue', () => {
    expect(describeFile('frontend/src/domain/Kanban/KanbanScreen.vue')).toBe('Ecran Kanban')
    expect(describeFile('frontend/src/domain/Resource/MachineBadge.vue')).toBe('Composant MachineBadge')
  })

  it('reconnait un test', () => {
    expect(describeFile('backend/tests/domain/File/FileMark.test.ts')).toBe('Tests de FileMark')
  })

  it('reconnait une brique technique', () => {
    expect(describeFile('backend/src/technical/Git/GitWorktree.ts')).toBe('Brique technique Git')
  })

  it('reconnait les fichiers de racine connus', () => {
    expect(describeFile('package.json')).toBe('Dependances et scripts du depot')
    expect(describeFile('db/forge.sql')).toBe('Schema de la base')
  })

  it('reste muet plutot que d inventer', () => {
    expect(describeFile('quelque/chose/etrange.bin')).toBe('')
  })

  it('nomme un dossier par ce qu il contient', () => {
    expect(describeFile('backend/src/domain')).toBe('Le metier, un dossier par sujet')
  })
})
