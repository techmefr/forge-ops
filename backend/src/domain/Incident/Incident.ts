export type {
  Incident,
  IncidentOrigin,
  IncidentState,
  OriginKind,
} from '../../../../contract/OperationContract.js'

import type { IncidentOrigin } from '../../../../contract/OperationContract.js'

export type OriginDraft = Omit<IncidentOrigin, 'id'>

export type IncidentDraft = {
  originSlug: string
  fingerprint: string
  title: string
  detail: string
}
