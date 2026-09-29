import type { EpicState } from '@contract/EpicContract'
import type { DueBadge } from './SubjectRule'

export const STATE_TONES: Readonly<Record<EpicState, string>> = {
  todo: 'text-txt-mid',
  doing: 'text-info',
  blocked: 'text-warn',
  done: 'text-green',
  trash: 'text-txt-low',
}

export const DUE_TONES: Readonly<Record<DueBadge['kind'], string>> = {
  none: 'text-txt-low',
  date: 'text-txt-mid',
  late: 'text-red',
  today: 'text-orange',
  soon: 'text-orange',
  ahead: 'text-txt-mid',
}

export function dayLabel(day: string, locale: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function initialsOfLogin(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter((word) => word !== '')
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}
