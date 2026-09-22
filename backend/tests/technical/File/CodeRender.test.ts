import { describe, expect, it } from 'vitest'
import { createCodeRenderer, EXTENSION_LANGUAGE } from '../../../src/technical/File/CodeRender.js'

const HOSTILE =
  '<script>alert(1)</script><div class="x">unclosed<img src=x onerror=alert(2)><p attr="broken" quote\'>lone & ampersand'

const SHIKI_TAGS = new Set(['pre', 'code', 'span', 'div'])

function hasNoLiveElement(html: string): boolean {
  const tags = html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)/g)
  for (const [, tagName] of tags) {
    if (!SHIKI_TAGS.has((tagName ?? '').toLowerCase())) {
      return false
    }
  }
  return !html.includes('<script') && !html.includes('<img ')
}

describe('createCodeRenderer safety', () => {
  const renderer = createCodeRenderer()
  const extensions = [...new Set(Object.keys(EXTENSION_LANGUAGE))]

  it.each(extensions)('renders hostile content inert for .%s files', async (extension) => {
    const { html } = await renderer.renderedOf(HOSTILE, `sample.${extension}`)
    expect(hasNoLiveElement(html)).toBe(true)
    expect(html).not.toContain('<script>')
  })

  it('renders hostile content inert on the unknown-extension fallback path', async () => {
    const { html, known } = await renderer.renderedOf(HOSTILE, 'sample.unknownext')
    expect(known).toBe(false)
    expect(hasNoLiveElement(html)).toBe(true)
    expect(html).toBe(
      HOSTILE.replace(/[&<>"']/g, (sign) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[sign] ?? sign,
      ),
    )
  })

  it('renders hostile content inert on a fresh, not-yet-cached renderer instance', async () => {
    const fresh = createCodeRenderer()
    const { html } = await fresh.renderedOf(HOSTILE, 'sample.ts')
    expect(hasNoLiveElement(html)).toBe(true)
    expect(html).not.toContain('<script>')
  })
})

describe('createCodeRenderer degraded state', () => {
  it('falls back to escaped plain text when the render exceeds the timeout budget', async () => {
    const renderer = createCodeRenderer({
      timeoutMs: 10,
      highlighterOf: () => new Promise(() => {}),
    })
    const { html, known, timedOut } = await renderer.renderedOf('const a = "<b>"', 'huge.ts')
    expect(timedOut).toBe(true)
    expect(known).toBe(true)
    expect(html).toBe(
      'const a = "<b>"'.replace(/[&<>"']/g, (sign) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[sign] ?? sign,
      ),
    )
  })
})

describe('languageOfPath via EXTENSION_LANGUAGE', () => {
  it('reconnait un vrai grammaire vue, pas xml', () => {
    expect(EXTENSION_LANGUAGE.vue).toBe('vue')
  })
})
