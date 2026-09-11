import { describe, expect, it } from 'vitest'
import { BRACKET_DEPTHS, decoratedOf } from '@/technical/Ui/CodeDecor'

describe('decoratedOf', () => {
  it('laisse une ligne sans indentation ni parenthese intacte', () => {
    expect(decoratedOf('const a = 1')).toBe('const a = 1')
  })

  it('transforme l indentation en guides numerotes', () => {
    expect(decoratedOf('    if (a) {')).toContain('class="ind ind-0"')
    expect(decoratedOf('    if (a) {')).toContain('class="ind ind-1"')
  })

  it('colore les paires de parentheses par profondeur', () => {
    const said = decoratedOf('fn(a[0])')
    expect(said).toContain('class="brk brk-0">(')
    expect(said).toContain('class="brk brk-1">[')
    expect(said).toContain('class="brk brk-1">]')
    expect(said).toContain('class="brk brk-0">)')
  })

  it('recycle les couleurs au dela de la dernière profondeur', () => {
    const deep = `${'('.repeat(BRACKET_DEPTHS + 1)}a`
    expect(deep.length > 0 && decoratedOf(deep)).toContain(`class="brk brk-0">(`)
    expect(decoratedOf(deep)).toContain(`class="brk brk-${BRACKET_DEPTHS - 1}">(`)
  })

  it('ne touche pas aux balises du code déjà colore', () => {
    const html = '<span class="hljs-keyword">const</span> a = [1]'
    const said = decoratedOf(html)
    expect(said).toContain('<span class="hljs-keyword">const</span>')
    expect(said).toContain('class="brk brk-0">[')
  })

  it('ne colore pas une accolade cachee dans un attribut de balise', () => {
    const said = decoratedOf('<span title="{a}">x</span> [1]')
    expect(said).toContain('<span title="{a}">')
    expect(said).toContain('class="brk brk-0">[')
  })

  it('ne compte pas une parenthese fermante de trop comme une profondeur negative', () => {
    expect(decoratedOf(')')).toContain('class="brk brk-0">)')
  })
})
