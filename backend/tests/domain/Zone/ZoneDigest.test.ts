import { describe, expect, it } from 'vitest'
import { describeZone, kindOfPath } from '../../../src/domain/Zone/ZoneDigest.js'
import type { ZoneFile, ZoneOverview } from '../../../src/domain/Zone/Zone.js'

function overview(files: readonly ZoneFile[]): ZoneOverview {
  return {
    zone: {
      id: 1,
      projectId: 1,
      pathPrefix: 'backend/src/domain/Mail',
      name: 'Mail',
      colour: '#ff3b00',
      summary: null,
    },
    files,
    storyCount: new Set(files.map((file) => file.storyReference)).size,
  }
}

function touched(path: string, storyReference = 'FORGE-1'): ZoneFile {
  return { path, storyReference, agentName: null }
}

describe('kindOfPath', () => {
  it('recognises a test', () => {
    expect(kindOfPath('backend/tests/domain/Mail/MailRepository.test.ts')).toBe('tests')
  })

  it('recognises a screen', () => {
    expect(kindOfPath('frontend/src/domain/Mail/MailScreen.vue')).toBe('interface')
  })

  it('recognises the schema', () => {
    expect(kindOfPath('db/forge.sql')).toBe('schema')
  })

  it('calls the rest code', () => {
    expect(kindOfPath('backend/src/domain/Mail/MailRepository.ts')).toBe('code')
  })

  it('is not fooled by a folder named test inside a source path', () => {
    expect(kindOfPath('backend/src/domain/Contest/Contest.ts')).toBe('code')
  })
})

describe('an untouched zone', () => {
  it('says so rather than inventing a description', () => {
    expect(describeZone(overview([]))).toBe('Aucun fichier touche pour l instant.')
  })
})

describe('a zone one story works in', () => {
  it('counts the files it holds', () => {
    expect(describeZone(overview([touched('backend/src/domain/Mail/Mail.ts')]))).toContain('1 fichier')
  })

  it('names the story that touches it', () => {
    expect(describeZone(overview([touched('backend/src/domain/Mail/Mail.ts')]))).toContain('FORGE-1')
  })

  it('says what kind of files dominate', () => {
    const digest = describeZone(
      overview([
        touched('backend/tests/domain/Mail/A.test.ts'),
        touched('backend/tests/domain/Mail/B.test.ts'),
        touched('backend/src/domain/Mail/Mail.ts'),
      ]),
    )

    expect(digest).toContain('tests')
  })
})

describe('the share of a zone', () => {
  it('reads as French for an interface, not as a bare word', () => {
    expect(describeZone(overview([touched('frontend/src/domain/Mail/MailScreen.vue')]))).toContain(
      'de l interface',
    )
  })

  it('reads as French for tests', () => {
    expect(describeZone(overview([touched('backend/tests/domain/Mail/A.test.ts')]))).toContain('des tests')
  })

  it('reads as French for the schema', () => {
    expect(describeZone(overview([touched('db/forge.sql')]))).toContain('du schema')
  })

  it('reads as French for the rest', () => {
    expect(describeZone(overview([touched('backend/src/domain/Mail/Mail.ts')]))).toContain('du code')
  })
})

describe('a zone two stories share', () => {
  it('names both, that is how a collision gets noticed', () => {
    const digest = describeZone(
      overview([
        touched('backend/src/domain/Mail/Mail.ts', 'FORGE-1'),
        touched('backend/src/domain/Mail/MailApi.ts', 'FORGE-3'),
      ]),
    )

    expect(digest).toContain('FORGE-1')
    expect(digest).toContain('FORGE-3')
  })

  it('pluralises the count', () => {
    const digest = describeZone(
      overview([
        touched('backend/src/domain/Mail/Mail.ts', 'FORGE-1'),
        touched('backend/src/domain/Mail/MailApi.ts', 'FORGE-3'),
      ]),
    )

    expect(digest).toContain('2 fichiers')
  })

  it('stays short, two sentences at most', () => {
    const digest = describeZone(
      overview([
        touched('backend/src/domain/Mail/Mail.ts', 'FORGE-1'),
        touched('backend/src/domain/Mail/MailApi.ts', 'FORGE-3'),
      ]),
    )

    expect(digest.split('.').filter((part) => part.trim() !== '')).toHaveLength(2)
  })

  it('does not name the same story twice', () => {
    const digest = describeZone(
      overview([
        touched('backend/src/domain/Mail/Mail.ts', 'FORGE-1'),
        touched('backend/src/domain/Mail/MailApi.ts', 'FORGE-1'),
      ]),
    )

    expect(digest.match(/FORGE-1/g)).toHaveLength(1)
  })
})
