import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Ticket } from '@/domain/Board/BoardModel'
import { createBoardI18n } from '@/technical/Language/I18n'
import StoryTicket from '@/domain/Story/StoryTicket.vue'

function ticketWith(gaps: readonly string[], gapCodes: readonly string[]): Ticket {
  return {
    functional: {
      id: 1,
      reference: 'S-1',
      title: 'Export the mails',
      body: 'short',
      state: 'drafting',
    },
    tests: null,
    criteria: [],
    dod: [],
    cascade: [],
    blockers: [],
    stepBacks: [],
    completeness: { score: 30, launchable: false, gaps, gapCodes },
  } as unknown as Ticket
}

function mounted(language: 'en' | 'fr', ticket: Ticket) {
  return mount(StoryTicket, {
    props: { ticket, part: 'functional' },
    global: { plugins: [createBoardI18n(language)] },
  })
}

describe('the completeness gaps of a story', () => {
  const ticket = ticketWith(
    ['the body does not say enough to be coded', 'the story carries fewer than 2 acceptance criteria'],
    ['BodyTooShort', 'CriteriaMissing'],
  )

  it('are shown in the language of the interface, not in the server wording', () => {
    const english = mounted('en', ticket).text()

    expect(english).toContain('The body says too little.')
    expect(english).toContain('The acceptance criteria are missing.')
    expect(english).not.toContain('carries fewer than')
  })

  it('follow the interface language', () => {
    expect(mounted('fr', ticket).text()).not.toContain('The body says too little.')
  })

  it('fall back to the server wording when a gap has no known code', () => {
    const text = mounted('en', ticketWith(['something new is missing'], [])).text()

    expect(text).toContain('something new is missing')
  })
})
