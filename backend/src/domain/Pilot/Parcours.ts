import type { PilotStep } from './Pilot.js'

export type ParcoursCriterion = {
  reference: string
  statement: string
}

export type { ParcoursSuggestion } from '../../../../contract/PilotContract.js'

import type { ParcoursSuggestion } from '../../../../contract/PilotContract.js'

export type ParcoursQuestion = {
  port: number | null
  criteria: readonly ParcoursCriterion[]
}

export function suggestParcours({ port, criteria }: ParcoursQuestion): ParcoursSuggestion {
  if (port === null) {
    return {
      url: '',
      script: [],
      reason: "la story n a pas de worktree ouvert, le board ne sait pas ou regarder",
    }
  }
  const url = `http://localhost:${port}/`
  const looks: readonly PilotStep[] =
    criteria.length === 0
      ? [{ kind: 'screenshot' }]
      : criteria.map(() => ({ kind: 'screenshot' }) as PilotStep)
  return {
    url,
    script: [{ kind: 'goto', target: url }, ...looks],
    reason:
      criteria.length === 0
        ? "aucun critere d acceptation declare, le parcours ne fait qu ouvrir la page"
        : `un regard par critere : ${criteria.map((criterion) => criterion.reference).join(', ')}`,
  }
}
