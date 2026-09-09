export type OriginKind = 'sentry' | 'user_report' | 'idea' | 'manual'

export type IncidentState = 'pending' | 'accepted' | 'refused'

export type IncidentOrigin = {
  id: number
  slug: string
  name: string
  kind: OriginKind
}

export type OriginDraft = Omit<IncidentOrigin, 'id'>

export type Incident = {
  id: number
  originId: number
  fingerprint: string
  title: string
  detail: string
  occurrences: number
  state: IncidentState
  storyId: number | null
  refusalReason: string | null
}

export type IncidentDraft = {
  originSlug: string
  fingerprint: string
  title: string
  detail: string
}
