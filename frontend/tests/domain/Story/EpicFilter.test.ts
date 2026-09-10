import { describe, expect, it } from 'vitest'
import {
  OWNERSHIPS,
  OWNERSHIP_LABELS,
  keepEpics,
  oneProjectOnly,
} from '@/domain/Story/EpicFilter'
import type { EpicOverview } from '@/domain/Board/BoardModel'

function epic(id: number, projectId: number, assignee: string | null): EpicOverview {
  return {
    id,
    projectId,
    title: `Epique ${id}`,
    businessIntent: 'un besoin',
    assignee,
    storyCount: 0,
  }
}

const EPICS: readonly EpicOverview[] = [
  epic(1, 10, null),
  epic(2, 10, 'gaetan'),
  epic(3, 11, 'quelqu un'),
  epic(4, 11, null),
]

describe('les filtres d attribution', () => {
  it('offrent tout, les miennes et les libres', () => {
    expect([...OWNERSHIPS]).toEqual(['all', 'mine', 'free'])
  })

  it('nomment chaque filtre', () => {
    for (const ownership of OWNERSHIPS) {
      expect(OWNERSHIP_LABELS[ownership].length).toBeGreaterThan(0)
    }
  })
})

describe('keepEpics', () => {
  it('rend tout quand rien n est filtre', () => {
    expect(keepEpics(EPICS, { projectId: null, ownership: 'all', self: 'gaetan' })).toHaveLength(4)
  })

  it('garde le projet demande', () => {
    expect(
      keepEpics(EPICS, { projectId: 10, ownership: 'all', self: 'gaetan' }).map((found) => found.id),
    ).toEqual([1, 2])
  })

  it('garde ce qui m est attribue', () => {
    expect(
      keepEpics(EPICS, { projectId: null, ownership: 'mine', self: 'gaetan' }).map(
        (found) => found.id,
      ),
    ).toEqual([2])
  })

  it('garde ce que personne ne tient', () => {
    expect(
      keepEpics(EPICS, { projectId: null, ownership: 'free', self: 'gaetan' }).map(
        (found) => found.id,
      ),
    ).toEqual([1, 4])
  })

  it('ne me donne pas les epiques d un autre', () => {
    expect(
      keepEpics(EPICS, { projectId: null, ownership: 'mine', self: 'gaetan' }).map(
        (found) => found.assignee,
      ),
    ).toEqual(['gaetan'])
  })

  it('croise le projet et l attribution', () => {
    expect(
      keepEpics(EPICS, { projectId: 11, ownership: 'free', self: 'gaetan' }).map(
        (found) => found.id,
      ),
    ).toEqual([4])
  })

  it('rend une liste vide quand le croisement ne donne rien', () => {
    expect(keepEpics(EPICS, { projectId: 11, ownership: 'mine', self: 'gaetan' })).toEqual([])
  })
})

describe('oneProjectOnly', () => {
  it('accepte deux epiques du meme projet', () => {
    expect(oneProjectOnly(EPICS, [1, 2])).toBe(true)
  })

  it('refuse deux epiques de projets differents', () => {
    expect(oneProjectOnly(EPICS, [1, 3])).toBe(false)
  })

  it('accepte une seule epique', () => {
    expect(oneProjectOnly(EPICS, [3])).toBe(true)
  })

  it('accepte une selection vide, il n y a rien a refuser', () => {
    expect(oneProjectOnly(EPICS, [])).toBe(true)
  })

  it('ignore un identifiant qui ne designe aucune epique', () => {
    expect(oneProjectOnly(EPICS, [1, 999])).toBe(true)
  })
})
