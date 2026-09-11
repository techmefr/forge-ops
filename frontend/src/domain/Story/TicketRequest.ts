import { phrase, type Phrase } from '@/technical/Language/Phrase'

export type TicketPoint = {
  kind: 'title' | 'body' | 'criterion' | 'gap' | 'step'
  text: string
}

const LIMIT = 120

const KEYS: Readonly<Record<TicketPoint['kind'], string>> = {
  title: 'ticket.askTitle',
  body: 'ticket.askBody',
  criterion: 'ticket.askCriterion',
  gap: 'ticket.askGap',
  step: 'ticket.askStep',
}

function short(text: string): string {
  return text.length > LIMIT ? `${text.slice(0, LIMIT)}…` : text
}

export function requestFor({ kind, text }: TicketPoint): Phrase {
  return phrase(KEYS[kind], { said: short(text) })
}
