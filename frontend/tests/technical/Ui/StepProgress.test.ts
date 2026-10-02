import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StepProgress from '@/technical/Ui/StepProgress.vue'

const STEPS = ['Create a project', 'Define the steps', 'Add a story'] as const

describe('StepProgress', () => {
  it('lists every step in order under an accessible label', () => {
    const progress = mount(StepProgress, { props: { steps: STEPS, current: 0, label: 'Getting started' } })
    expect(progress.attributes('aria-label')).toBe('Getting started')
    expect(progress.findAll('li').map((item) => item.text())).toEqual([
      '1Create a project',
      '2Define the steps',
      '3Add a story',
    ])
  })

  it('marks only the current step with aria-current', () => {
    const progress = mount(StepProgress, { props: { steps: STEPS, current: 1, label: 'Getting started' } })
    const current = progress.findAll('li').filter((item) => item.attributes('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]?.text()).toContain('Define the steps')
  })

  it('draws a check instead of the number for finished steps', () => {
    const progress = mount(StepProgress, { props: { steps: STEPS, current: 2, label: 'Getting started' } })
    const items = progress.findAll('li')
    expect(items[0]?.find('svg').exists()).toBe(true)
    expect(items[1]?.find('svg').exists()).toBe(true)
    expect(items[2]?.find('svg').exists()).toBe(false)
  })
})
