const OUTCOME_LABELS: Record<string, string> = {
  succeeded: 'Réussie',
  failed: 'Échouée',
  interrupted: 'Interrompue',
  killed: 'Tuée',
  timed_out: 'Temps dépassé',
  budget_exhausted: 'Plafond atteint',
  permission_denied: 'Permission refusée',
  looping: 'Tournait en boucle',
  awaiting_human: 'Attend ta réponse',
  runner_missing: 'Lanceur introuvable',
  unknown: 'Sortie inconnue',
}

const LIFECYCLE_LABELS: Record<string, string> = {
  starting: 'Démarrée',
  working: 'Au travail',
  awaiting_human: 'Attend ta réponse',
  finished: 'Finie',
  failed: 'Échouée',
  interrupted: 'Interrompue',
}

export function sessionEndOf(outcome: string | null, lifecycle: string): string {
  if (outcome !== null) {
    return OUTCOME_LABELS[outcome] ?? outcome
  }
  return LIFECYCLE_LABELS[lifecycle] ?? lifecycle
}

export function countedOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${Math.abs(count) > 1 ? plural : singular}`
}
