import type { Incident } from '@contract/OperationContract'
import {
  bodyNumber,
  bodyText,
  identifierAt,
  nextIdentifier,
  refusal,
  reply,
  route,
  setSingleton,
  type DemoContext,
  type DemoReply,
  type DemoRoute,
} from './DemoModel'

function incidentsOf(context: DemoContext): Incident[] {
  return (context.state.singletons['/api/incidents'] ?? []) as Incident[]
}

function decide(context: DemoContext, change: (incident: Incident) => DemoReply): DemoReply {
  const held = incidentsOf(context)
  const incident = held.find((candidate) => candidate.id === identifierAt(context))
  if (incident === undefined) {
    return refusal(404, 'IncidentNotFound', 'This incident does not exist')
  }
  if (incident.state !== 'pending') {
    return refusal(409, 'IncidentAlreadyDecided', 'This incident was already decided')
  }
  const answer = change(incident)
  setSingleton(context.state, '/api/incidents', [...held])
  return answer
}

export const INCIDENT_ROUTES: readonly DemoRoute[] = [
  route('POST', '/api/incidents/(\\d+)/accept', (context) =>
    decide(context, (incident) => {
      const epicId = bodyNumber(context.body, 'epicId')
      if (epicId === null || !context.state.epics.some((epic) => epic.id === epicId)) {
        return refusal(422, 'InvalidAcceptance', 'Pick the subject that takes this incident')
      }
      incident.state = 'accepted'
      incident.storyId = nextIdentifier(context.state)
      return reply({ incident, story: { id: incident.storyId, epicId } }, 201)
    }),
  ),
  route('POST', '/api/incidents/(\\d+)/refuse', (context) =>
    decide(context, (incident) => {
      const reason = bodyText(context.body, 'reason')?.trim() ?? ''
      if (reason === '') {
        return refusal(422, 'InvalidRefusal', 'Say why it is refused')
      }
      incident.state = 'refused'
      incident.refusalReason = reason
      return reply(incident)
    }),
  ),
]
