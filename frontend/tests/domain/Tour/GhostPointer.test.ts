import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { AIM_ATTEMPTS, aimDelayOf } from '@/domain/Tour/TourGesture'
import GhostPointer from '@/domain/Tour/GhostPointer.vue'

function anchored(): HTMLElement {
  const target = document.createElement('div')
  target.setAttribute('data-tour', 'somewhere')
  target.getBoundingClientRect = () =>
    ({ left: 100, top: 40, width: 200, height: 60 }) as DOMRect
  document.body.appendChild(target)
  return target
}

describe('le pointeur fantome se montre la ou la visite regarde', () => {
  it('apparait sur le centre de son ancrage', async () => {
    anchored()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const guide = mount(GhostPointer, { props: { anchor: 'somewhere', gesture: 'point' } })
    await vi.waitFor(() => {
      expect(guide.find('[aria-hidden="true"]').exists()).toBe(true)
    })
    expect(guide.find('[aria-hidden="true"]').attributes('style')).toContain('left: 200px')
  })

  it('ne montre rien quand la visite ne vise rien', async () => {
    const guide = mount(GhostPointer, { props: { anchor: null, gesture: 'point' } })
    await vi.waitFor(() => {
      expect(guide.html()).toBe('<!--v-if-->')
    })
  })
})

describe('le pointeur attend son ancrage au lieu d abandonner', () => {
  it('retente quelques fois, en espacant les essais', () => {
    expect(aimDelayOf(0)).toBe(120)
    expect(aimDelayOf(1)).toBeGreaterThan(aimDelayOf(0) as number)
    expect(aimDelayOf(AIM_ATTEMPTS - 1)).not.toBeNull()
  })

  it('renonce apres le dernier essai', () => {
    expect(aimDelayOf(AIM_ATTEMPTS)).toBeNull()
    expect(aimDelayOf(-1)).toBeNull()
  })

  it('finit par se poser sur un ancrage arrive en retard', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const guide = mount(GhostPointer, { props: { anchor: 'late', gesture: 'point' } })
    expect(guide.find('[aria-hidden="true"]').exists()).toBe(false)
    const target = document.createElement('div')
    target.setAttribute('data-tour', 'late')
    target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 20 }) as DOMRect
    document.body.appendChild(target)
    await vi.waitFor(
      () => {
        expect(guide.find('[aria-hidden="true"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )
  })
})
