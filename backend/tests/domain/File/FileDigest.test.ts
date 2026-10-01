import { describe, expect, it } from 'vitest'
import { describeFile } from '../../../src/domain/File/FileDigest.js'

describe('describeFile', () => {
  it('names a domain repository after its subject', () => {
    expect(describeFile('backend/src/domain/Story/StoryRepository.ts')).toEqual({
      key: 'repository',
      values: { subject: 'Story' },
    })
  })

  it('names a domain api after its subject', () => {
    expect(describeFile('backend/src/domain/Story/StoryApi.ts')).toEqual({ key: 'api', values: { subject: 'Story' } })
  })

  it('names a screen and a component', () => {
    expect(describeFile('frontend/src/domain/Kanban/KanbanScreen.vue')).toEqual({
      key: 'screen',
      values: { subject: 'Kanban' },
    })
    expect(describeFile('frontend/src/domain/Resource/MachineBadge.vue')).toEqual({
      key: 'component',
      values: { name: 'MachineBadge' },
    })
  })

  it('names a test after the file it covers', () => {
    expect(describeFile('backend/tests/domain/File/FileMark.test.ts')).toEqual({
      key: 'testOf',
      values: { name: 'FileMark' },
    })
  })

  it('names a technical brick after its area', () => {
    expect(describeFile('backend/src/technical/Git/GitWorktree.ts')).toEqual({
      key: 'technicalBrick',
      values: { area: 'Git' },
    })
  })

  it('names the well known root files', () => {
    expect(describeFile('package.json')).toEqual({ key: 'packageJson', values: {} })
    expect(describeFile('db/forge.sql')).toEqual({ key: 'databaseSchema', values: {} })
  })

  it('says nothing about a file it does not know', () => {
    expect(describeFile('some/odd/thing.bin')).toBeNull()
  })

  it('names the well known folders', () => {
    expect(describeFile('backend/src/domain')).toEqual({ key: 'folderDomain', values: {} })
  })
})
