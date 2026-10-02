import { CAPACITY_MAX, CAPACITY_MIN, type ProjectSheet } from '@contract/ProjectContract'
import { phrase, type Phrase } from '@/technical/Language/Phrase'

export type TeamSelf = {
  login: string
  superAdmin: boolean
  director?: boolean
}

export const LOCAL_OPERATOR = 'local'

export function usedBy(usage: number): Phrase | null {
  return usage > 0 ? phrase('team.usedBy', {}, usage) : null
}

export function mayChangeAdmin(sheet: ProjectSheet, self: TeamSelf | null): boolean {
  if (self === null) {
    return false
  }
  if (self.superAdmin || self.login === LOCAL_OPERATOR) {
    return true
  }
  return sheet.adminLogin === null ? self.director === true : self.login === sheet.adminLogin
}

export function positionAfterMove(index: number, direction: -1 | 1, total: number): number | null {
  const target = index + direction
  return target < 0 || target >= total ? null : target
}

export function capacityFrom(text: string): number | null | 'refused' {
  const trimmed = text.trim()
  if (trimmed === '') {
    return null
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'refused'
  }
  const value = Number(trimmed)
  return value < CAPACITY_MIN || value > CAPACITY_MAX ? 'refused' : value
}
