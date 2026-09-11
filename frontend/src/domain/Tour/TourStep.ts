export type TourStep = {
  id: string
  path: string
  anchor: string
  titleKey: string
  bodyKey: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'board',
    path: '/forge',
    anchor: 'shell-heading',
    titleKey: 'tour.board.title',
    bodyKey: 'tour.board.body',
  },
  {
    id: 'column',
    path: '/forge',
    anchor: 'kanban-columns',
    titleKey: 'tour.column.title',
    bodyKey: 'tour.column.body',
  },
  {
    id: 'story',
    path: '/forge',
    anchor: 'kanban-card',
    titleKey: 'tour.story.title',
    bodyKey: 'tour.story.body',
  },
  {
    id: 'review',
    path: '/forge',
    anchor: 'kanban-card',
    titleKey: 'tour.review.title',
    bodyKey: 'tour.review.body',
  },
  {
    id: 'evidence',
    path: '/project',
    anchor: 'file-legend',
    titleKey: 'tour.evidence.title',
    bodyKey: 'tour.evidence.body',
  },
  {
    id: 'guardrail',
    path: '/project',
    anchor: 'scope-reservation',
    titleKey: 'tour.guardrail.title',
    bodyKey: 'tour.guardrail.body',
  },
]
