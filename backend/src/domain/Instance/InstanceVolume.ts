export const VOLUME_COMPLAINTS = ['missingVolume', 'unwritableVolume', 'emptyDatabase'] as const

export type VolumeComplaint = (typeof VOLUME_COMPLAINTS)[number]

export type VolumeState = {
  path: string
  exists: boolean
  writable: boolean
  hasDatabase: boolean
}

export function complaintOf(state: VolumeState): VolumeComplaint | null {
  if (!state.exists) {
    return 'missingVolume'
  }
  if (!state.writable) {
    return 'unwritableVolume'
  }
  return state.hasDatabase ? null : 'emptyDatabase'
}

export function saidAloud(state: VolumeState, complaint: VolumeComplaint): string {
  const said: Readonly<Record<VolumeComplaint, string>> = {
    missingVolume: `le volume ${state.path} est absent: montez-le avant de demarrer l instance`,
    unwritableVolume: `le volume ${state.path} n est pas accessible en ecriture`,
    emptyDatabase: `le volume ${state.path} ne porte aucune base: l instance demarre vide`,
  }
  return said[complaint]
}

export function startsAnyway(complaint: VolumeComplaint): boolean {
  return complaint === 'emptyDatabase'
}
