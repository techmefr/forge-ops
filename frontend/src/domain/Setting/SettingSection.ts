import type { AccountRole } from '@contract/IdentityContract'

export const SETTING_EFFECTS = ['immediate', 'restart'] as const

export type SettingEffect = (typeof SETTING_EFFECTS)[number]

export const SETTING_HALVES = ['mine', 'organisation'] as const

export type SettingHalf = (typeof SETTING_HALVES)[number]

export type SettingSection = {
  key: string
  half: SettingHalf
  effect: SettingEffect
}

export const SETTING_SECTIONS: readonly SettingSection[] = [
  { key: 'appearance', half: 'mine', effect: 'immediate' },
  { key: 'account', half: 'mine', effect: 'immediate' },
  { key: 'templates', half: 'organisation', effect: 'immediate' },
  { key: 'budget', half: 'organisation', effect: 'immediate' },
  { key: 'organisation', half: 'organisation', effect: 'restart' },
  { key: 'delivery', half: 'organisation', effect: 'immediate' },
]

export function sectionsOf(half: SettingHalf): readonly SettingSection[] {
  return SETTING_SECTIONS.filter((section) => section.half === half)
}

export function effectOf(key: string): SettingEffect | null {
  return SETTING_SECTIONS.find((section) => section.key === key)?.effect ?? null
}

export function keepsTheOrganisation(role: AccountRole | null, alone: boolean): boolean {
  return alone || role === 'director'
}
