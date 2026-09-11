export type Desk = {
  key: 'write' | 'reports'
  label: string
  said: string
}

export const DESKS: readonly Desk[] = [
  { key: 'write', label: 'Ecrire', said: 'Decouper une epique en stories et les rediger avec Claude' },
  { key: 'reports', label: 'Signalements', said: 'Ce que les agents bloquent et qui attend un arbitrage humain' },
]
