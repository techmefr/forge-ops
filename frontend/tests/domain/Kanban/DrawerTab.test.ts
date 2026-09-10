import { describe, expect, it } from 'vitest'
import { DRAWER_TABS, DRAWER_TAB_LABELS, tabOfState } from '@/domain/Kanban/DrawerTab'

const COLUMN_STATES = [
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'shipping',
  'flagged',
  'done',
]

describe('les onglets du tiroir', () => {
  it('vont de la story a la discussion', () => {
    expect([...DRAWER_TABS]).toEqual(['story', 'plan', 'review', 'delivery', 'discussion'])
  })

  it('portent tous un nom', () => {
    for (const tab of DRAWER_TABS) {
      expect(DRAWER_TAB_LABELS[tab].length).toBeGreaterThan(0)
    }
  })
})

describe('tabOfState', () => {
  it('ouvre le plan pour une story en architecture', () => {
    expect(tabOfState('architecture')).toBe('plan')
  })

  it('ouvre le plan pour un plan a valider', () => {
    expect(tabOfState('plan_review')).toBe('plan')
  })

  it('ouvre la review quand la story est en verification', () => {
    expect(tabOfState('reviewing')).toBe('review')
  })

  it('ouvre la livraison quand la story part', () => {
    expect(tabOfState('shipping')).toBe('delivery')
  })

  it('ouvre la story pour un etat sans onglet propre', () => {
    expect(tabOfState('drafting')).toBe('story')
  })

  it('donne un onglet connu a chaque colonne du kanban', () => {
    for (const state of COLUMN_STATES) {
      expect(DRAWER_TABS).toContain(tabOfState(state))
    }
  })
})
