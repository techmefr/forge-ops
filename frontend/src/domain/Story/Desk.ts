export type Desk = {
  key: 'write' | 'reports'
  label: string
  said: string
}

export const DESKS: readonly Desk[] = [
  { key: 'write', label: 'Écrire', said: 'Découper une épique en stories et les rédiger avec Claude' },
  { key: 'reports', label: 'Signalements', said: 'Ce que les agents bloquent et qui attend un arbitrage humain' },
]
