const OUTCOME_DOT_COLOURS: Readonly<Record<string, string>> = {
  succeeded: 'bg-green',
  awaiting_human: 'bg-warn',
  failed: 'bg-red',
  killed: 'bg-red',
  timed_out: 'bg-orange',
  budget_exhausted: 'bg-orange',
  permission_denied: 'bg-orange',
  looping: 'bg-orange',
  interrupted: 'bg-txt-mid',
  runner_missing: 'bg-red',
  unknown: 'bg-txt-low',
}

const LIFECYCLE_DOT_COLOURS: Readonly<Record<string, string>> = {
  starting: 'bg-txt-low',
  working: 'bg-acc',
  awaiting_human: 'bg-warn',
  finished: 'bg-green',
  failed: 'bg-red',
  interrupted: 'bg-txt-mid',
}

export function dotColourOf(outcome: string | null, lifecycle: string): string {
  if (outcome !== null) {
    return OUTCOME_DOT_COLOURS[outcome] ?? 'bg-txt-low'
  }
  return LIFECYCLE_DOT_COLOURS[lifecycle] ?? 'bg-txt-low'
}
