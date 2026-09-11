export const DESKS = ['write', 'reports'] as const

export type Desk = (typeof DESKS)[number]
