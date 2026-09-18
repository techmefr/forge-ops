import type { TourGesture } from '../../../../contract/TourContract'

export type TourStep = {
  id: string
  path: string
  anchor: string
  gesture: TourGesture
  titleKey: string
  sayKey: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'pipeline',
    path: '/projects/board',
    anchor: 'shell-pipeline',
    gesture: 'sweep',
    titleKey: 'tour.pipeline.title',
    sayKey: 'tour.pipeline.say',
  },
  {
    id: 'column',
    path: '/projects/board',
    anchor: 'kanban-columns',
    gesture: 'sweep',
    titleKey: 'tour.column.title',
    sayKey: 'tour.column.say',
  },
  {
    id: 'story',
    path: '/projects/board',
    anchor: 'kanban-card',
    gesture: 'point',
    titleKey: 'tour.story.title',
    sayKey: 'tour.story.say',
  },
  {
    id: 'mine',
    path: '/me/stories',
    anchor: 'personal-tally',
    gesture: 'open',
    titleKey: 'tour.mine.title',
    sayKey: 'tour.mine.say',
  },
  {
    id: 'evidence',
    path: '/me/files',
    anchor: 'file-legend',
    gesture: 'point',
    titleKey: 'tour.evidence.title',
    sayKey: 'tour.evidence.say',
  },
  {
    id: 'guardrail',
    path: '/me/files',
    anchor: 'scope-reservation',
    gesture: 'point',
    titleKey: 'tour.guardrail.title',
    sayKey: 'tour.guardrail.say',
  },
  {
    id: 'ledger',
    path: '/statistics',
    anchor: 'statistic-tally',
    gesture: 'sweep',
    titleKey: 'tour.ledger.title',
    sayKey: 'tour.ledger.say',
  },
  {
    id: 'rules',
    path: '/settings',
    anchor: 'setting-organisation',
    gesture: 'open',
    titleKey: 'tour.rules.title',
    sayKey: 'tour.rules.say',
  },
]
