const JUDGEMENT_LABELS: Record<string, string> = {
  finding: 'Remarque',
  criterion_unmet: 'Critere non prouve',
  blocker: 'Bloqueur',
}

export function judgementLabelOf(kind: string): string {
  return JUDGEMENT_LABELS[kind] ?? kind
}
