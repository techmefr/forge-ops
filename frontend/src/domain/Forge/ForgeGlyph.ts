import type { DotState } from './ForgeRule'

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
