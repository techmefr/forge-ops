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
    path: '/projects/subjects',
    anchor: 'shell-pipeline',
    gesture: 'sweep',
    titleKey: 'tour.pipeline.title',
    sayKey: 'tour.pipeline.say',
  },
  {
    id: 'subjects',
    path: '/projects/subjects',
    anchor: 'subject-weather',
    gesture: 'point',
    titleKey: 'tour.subjects.title',
    sayKey: 'tour.subjects.say',
  },
  {
    id: 'workflows',
    path: '/me/forge',
    anchor: 'forge-workflows',
    gesture: 'point',
    titleKey: 'tour.workflows.title',
    sayKey: 'tour.workflows.say',
  },
  {
    id: 'steps',
    path: '/me/forge',
    anchor: 'forge-steps',
    gesture: 'sweep',
    titleKey: 'tour.steps.title',
    sayKey: 'tour.steps.say',
  },
  {
    id: 'card',
    path: '/me/forge',
    anchor: 'forge-card',
    gesture: 'open',
    titleKey: 'tour.card.title',
    sayKey: 'tour.card.say',
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
    id: 'deployment',
    path: '/projects/deployment',
    anchor: 'deployment-board',
    gesture: 'point',
    titleKey: 'tour.deployment.title',
    sayKey: 'tour.deployment.say',
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
    anchor: 'setting-tabs',
    gesture: 'open',
    titleKey: 'tour.rules.title',
    sayKey: 'tour.rules.say',
  },
]
