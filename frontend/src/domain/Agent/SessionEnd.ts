const OUTCOME_LABELS: Record<string, string> = {
  succeeded: 'Reussie',
  failed: 'Echouee',
  interrupted: 'Interrompue',
  killed: 'Tuee',
  timed_out: 'Temps depasse',
  budget_exhausted: 'Plafond atteint',
  permission_denied: 'Permission refusee',
  looping: 'Tournait en boucle',
  awaiting_human: 'Attend ta reponse',
  runner_missing: 'Lanceur introuvable',
  unknown: 'Sortie inconnue',
}

const LIFECYCLE_LABELS: Record<string, string> = {
  starting: 'Demarre',
  working: 'Au travail',
  awaiting_human: 'Attend ta reponse',
  finished: 'Finie',
  failed: 'Echouee',
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
