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
    path: '/projects/board',
    anchor: 'shell-heading',
    titleKey: 'tour.board.title',
    bodyKey: 'tour.board.body',
  },
  {
    id: 'column',
    path: '/projects/board',
    anchor: 'kanban-columns',
    titleKey: 'tour.column.title',
    bodyKey: 'tour.column.body',
  },
  {
    id: 'story',
    path: '/projects/board',
    anchor: 'kanban-card',
    titleKey: 'tour.story.title',
    bodyKey: 'tour.story.body',
  },
  {
    id: 'review',
    path: '/projects/board',
    anchor: 'kanban-card',
    titleKey: 'tour.review.title',
    bodyKey: 'tour.review.body',
  },
  {
    id: 'evidence',
    path: '/me/files',
    anchor: 'file-legend',
    titleKey: 'tour.evidence.title',
    bodyKey: 'tour.evidence.body',
  },
  {
    id: 'guardrail',
    path: '/me/files',
    anchor: 'scope-reservation',
    titleKey: 'tour.guardrail.title',
    bodyKey: 'tour.guardrail.body',
  },
]
