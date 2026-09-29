import { describe, expect, it } from 'vitest'
import { safeHref, UNSAFE_HREF } from '@/technical/Ui/SafeHref'

describe('safeHref', () => {
  it('keeps http and https links', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(safeHref('http://localhost:5049/')).toBe('http://localhost:5049/')
  })

  it('neutralises script, data and file schemes and anything unparsable', () => {
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'vbscript:x', '//evil.example', 'not a url']) {
      expect(safeHref(bad)).toBe(UNSAFE_HREF)
    }
  })
})
