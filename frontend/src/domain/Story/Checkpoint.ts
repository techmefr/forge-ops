import type { CheckpointName, ReviewLens, StoryState } from '@/domain/Board/BoardModel'

export const CHECKPOINT_LABELS: Record<CheckpointName, string> = {
  spec_done: 'Spécification écrite',
  arch_done: 'Architecture arrêtée',
  tests_written: 'Tests écrits et rouges',
  build_done: 'Tests verts',
  verified: 'Vérifié à la main',
  reviewed: 'Review passée',
}

export const LENS_LABELS: Record<ReviewLens, string> = {
  quality: 'Qualité',
  security: 'Sécurité',
  accessibility: 'Accessibilité',
}

export const STATE_LABELS: Record<StoryState, string> = {
  drafting: 'En écriture',
  backlog: 'Réserve',
  architecture: 'Architecture',
  plan_review: 'Plan à valider',
  building: 'Dev',
  gating: 'Test',
  reviewing: 'Review',
  shipping: 'Mergée',
  flagged: 'Feature flag',
  done: 'Prod',
  escalated: 'Escaladée',
}
