import { CAPACITY_MAX, CAPACITY_MIN, type ProjectSheet } from '@contract/ProjectContract'
import { phrase, type Phrase } from '@/technical/Language/Phrase'

export type TeamSelf = {
  login: string
  superAdmin: boolean
}

export const LOCAL_OPERATOR = 'local'

export function usedBy(usage: number): Phrase | null {
  return usage > 0 ? phrase('team.usedBy', {}, usage) : null
}

export function mayChangeAdmin(sheet: ProjectSheet, self: TeamSelf | null): boolean {
  if (self === null) {
    return false
  }
  return (
    sheet.adminUserId === null ||
    self.superAdmin ||
    self.login === LOCAL_OPERATOR ||
    self.login === sheet.adminLogin
  )
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

export function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter((word) => word !== '')
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function ownsTheWorkflow(sheet: ProjectSheet, self: TeamSelf | null): boolean {
  return self !== null && sheet.adminLogin !== null && sheet.adminLogin === self.login
}
