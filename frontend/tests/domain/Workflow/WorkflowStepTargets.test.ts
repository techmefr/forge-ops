import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { WorkflowColumn } from '@contract/WorkflowColumnContract'
import { createBoardI18n } from '@/technical/Language/I18n'
import WorkflowStepCard from '@/domain/Workflow/WorkflowStepCard.vue'

const COLUMN: WorkflowColumn = {
  id: 1,
  projectId: 3,
  key: 'spec',
  label: 'Spec',
  colour: '#7C3AED',
  position: 1,
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'high',
  agentName: '',
  command: '/speckit.specify',
  preprompt: 'Read the epic.',
  autoStart: true,
  behaviouralKind: 'ordinary',
  maxRetries: 2,
}

describe('WorkflowStepCard touch targets', () => {
  it('gives the colour picker and the up, down and remove buttons a 40px target on a phone', () => {
    const card = mount(WorkflowStepCard, {
      props: { column: COLUMN, index: 1, total: 3, busy: false },
      global: { plugins: [createBoardI18n('en')] },
    })

    const colour = card.get('input[type="color"]')
    expect(colour.classes()).toEqual(expect.arrayContaining(['max-sm:h-10', 'max-sm:w-10']))
    const buttons = card.findAll('button').slice(0, 3)
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button.classes()).toEqual(expect.arrayContaining(['btn']))
    }
  })
})
