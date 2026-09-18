import type { ProjectCard } from '@/domain/Board/BoardModel'

export const TALLY_FIGURES = ['mine', 'late', 'soon', 'attention'] as const

export const SOON_IN_DAYS = 7

export type Tally = {
  mine: number
  late: number
  soon: number
  attention: number
}

export function cardsOf(cards: readonly ProjectCard[], login: string | null): readonly ProjectCard[] {
  return login === null ? cards : cards.filter((card) => card.holder === login)
}

export function tallyOf(cards: readonly ProjectCard[], login: string | null): Tally {
  const mine = cardsOf(cards, login)
  return {
    mine: new Set(mine.map((card) => card.projectSlug)).size,
    late: mine.filter((card) => card.attention === 'late').length,
    soon: mine.filter(
      (card) => card.daysLeft !== null && card.daysLeft >= 0 && card.daysLeft <= SOON_IN_DAYS,
    ).length,
    attention: mine.filter((card) => card.attention !== null).length,
  }
}
