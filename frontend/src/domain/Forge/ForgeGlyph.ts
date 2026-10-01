import type { ForgeCardStatus } from '@contract/ForgeCardContract'
import type { DotState } from './ForgeRule'

export const STATUS_GLYPH: Readonly<Record<ForgeCardStatus, string>> = {
  idle: '○',
  running: '●',
  failed: '!',
  stopped: '■',
  budget_exhausted: '$',
  to_validate: '?',
  human_review: '◐',
  done: '✓',
}

export const DOT_GLYPH: Readonly<Record<DotState, string>> = {
  passed: '✓',
  running: '●',
  failed: '!',
  stopped: '■',
  budget_exhausted: '$',
  to_validate: '?',
  human_review: '◐',
  waiting: '○',
  to_come: '',
}
