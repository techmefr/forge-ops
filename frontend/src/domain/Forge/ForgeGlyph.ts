import type { DotState } from './ForgeRule'

export const DOT_ICON: Readonly<Record<DotState, string>> = {
  passed: 'check',
  running: 'play',
  failed: 'cross',
  stopped: 'stop',
  budget_exhausted: 'stop',
  to_validate: 'circle',
  human_review: 'circle',
  waiting: 'circle',
  to_come: '',
}
