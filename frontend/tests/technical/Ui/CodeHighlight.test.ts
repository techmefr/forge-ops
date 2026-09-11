import { describe, expect, it } from 'vitest'
import { highlightedOf, languageOfPath } from '@/technical/Ui/CodeHighlight'

describe('languageOfPath', () => {
  it('reconnait les langages du dépôt', () => {
    expect(languageOfPath('backend/src/domain/File/FileApi.ts')).toBe('typescript')
    expect(languageOfPath('frontend/src/domain/File/FileBrowser.vue')).toBe('xml')
    expect(languageOfPath('db/forge.sql')).toBe('sql')
    expect(languageOfPath('package.json')).toBe('json')
    expect(languageOfPath('start.sh')).toBe('bash')
    expect(languageOfPath('frontend/src/style.css')).toBe('css')
  })

  it('avoue ne pas savoir plutot que de deviner', () => {
    expect(languageOfPath('logo.png')).toBeNull()
  })
})

describe('highlightedOf', () => {
  it('colore les mots cles du typescript', () => {
    expect(highlightedOf('const forge = 1', 'typescript')).toContain('hljs-keyword')
  })

  it('echappe le html quand le langage est inconnu', () => {
    expect(highlightedOf('<script>alert(1)</script>', null)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('echappe le html meme quand il colore', () => {
    expect(highlightedOf('const a = "<b>"', 'typescript')).not.toContain('<b>')
  })
})
