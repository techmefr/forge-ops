import { describe, expect, it } from 'vitest'
import { PROMPT_TEMPLATE_KEYS, PROMPT_TEMPLATES } from '../../../../contract/WorkflowColumnContract.js'
import { stepVerdictSchema } from '../../../../contract/AutopilotContract.js'
import { verdictPathOf } from '../../../src/domain/Autopilot/StepBrief.js'

const PATH_PATTERN = verdictPathOf('<story reference>', '<step key>')

describe('the default step prompts', () => {
  it.each(PROMPT_TEMPLATE_KEYS)('%s ends by writing the verdict file the orchestrator reads', (key) => {
    const prompt = PROMPT_TEMPLATES[key]

    expect(prompt).toContain(PATH_PATTERN)
    expect(prompt).toContain('"status":"pass"')
    expect(prompt).toContain('"status":"fail"')
  })

  it('shows verdict examples the orchestrator accepts', () => {
    const examples = [...PROMPT_TEMPLATES.ship.matchAll(/\{"status":"[a-z]+","reason":"one sentence"\}/g)]

    expect(examples).toHaveLength(2)
    for (const example of examples) {
      expect(stepVerdictSchema.safeParse(JSON.parse(example[0])).success).toBe(true)
    }
  })

  it('makes Ship push the branch and finish with pass, never wait for a human merge', () => {
    const prompt = PROMPT_TEMPLATES.ship

    expect(prompt).toContain('Push the branch to origin')
    expect(prompt).toContain('Write pass once the branch is rebased, pushed and the gate is green')
    expect(prompt).toContain('never write a blocked verdict')
    expect(prompt).not.toContain('Open the MR as a draft')
  })

  it('stays inside the size the API accepts for a prompt', () => {
    for (const key of PROMPT_TEMPLATE_KEYS) {
      expect(PROMPT_TEMPLATES[key].length).toBeLessThan(8000)
    }
  })
})
