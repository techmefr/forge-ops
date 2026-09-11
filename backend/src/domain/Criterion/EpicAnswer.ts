import type { Criterion } from './Criterion.js'

export type EpicDelivery = {
  businessIntent: string
  criteria: readonly Criterion[]
}

function referencesOf(criteria: readonly Criterion[]): string {
  return criteria.map((criterion) => criterion.reference).join(', ')
}

export function whatTheEpicDidNotGet({ businessIntent, criteria }: EpicDelivery): readonly string[] {
  if (businessIntent.trim() === '') {
    return ["l epic n a declare aucune intention, il n y a rien a quoi la livraison puisse repondre"]
  }
  if (criteria.length === 0) {
    return ['aucun critere ne relie cette livraison a l intention de l epic']
  }
  const missing: string[] = []
  const unanswered = criteria.filter((criterion) => !criterion.satisfied)
  if (unanswered.length > 0) {
    missing.push(`criteres jamais repondus : ${referencesOf(unanswered)}`)
  }
  const unproven = criteria.filter((criterion) => criterion.satisfied && criterion.evidencePath === null)
  if (unproven.length > 0) {
    missing.push(`criteres declares satisfaits sans preuve : ${referencesOf(unproven)}`)
  }
  return missing
}
