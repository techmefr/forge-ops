import type { CheckpointName, ReviewLens, StoryState } from '@/domain/Board/BoardModel'

export const CHECKPOINT_LABELS: Record<CheckpointName, string> = {
  spec_done: 'Specification ecrite',
  arch_done: 'Architecture arretee',
  tests_written: 'Tests ecrits et rouges',
  build_done: 'Tests verts',
  verified: 'Verifie a la main',
  reviewed: 'Review passee',
}

export const LENS_LABELS: Record<ReviewLens, string> = {
  quality: 'Qualite',
  security: 'Securite',
  accessibility: 'Accessibilite',
}

export const STATE_LABELS: Record<StoryState, string> = {
  drafting: 'En ecriture',
  backlog: 'Reserve',
  architecture: 'Architecture',
  plan_review: 'Plan a valider',
  building: 'Dev',
  gating: 'Test',
  reviewing: 'Review',
  shipping: 'Merge',
  flagged: 'Feature flag',
  done: 'Prod',
  escalated: 'Escaladee',
}
