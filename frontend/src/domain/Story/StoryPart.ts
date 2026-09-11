import type { Story, Ticket } from '@/domain/Board/BoardModel'

export const PARTS = ['functional', 'tests'] as const

export type StoryPart = (typeof PARTS)[number]

export function partOf(ticket: Ticket | null, part: StoryPart): Story | null {
  if (ticket === null) {
    return null
  }
  return part === 'functional' ? ticket.functional : ticket.tests
}

export function bothPartsWritten(ticket: Ticket | null): boolean {
  return ticket !== null && ticket.tests !== null
}
