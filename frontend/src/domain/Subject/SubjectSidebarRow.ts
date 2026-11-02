import type { Flags, LoadTone } from './SubjectRule'
import type { Person } from './UseSubjects'

export type ViewRow = {
  key: string
  label: string
  count: number
  testId: string
  countId: string
}

export type PersonRow = {
  person: Person
  load: number
  text: string
  tone: LoadTone
  flags: Flags
}
