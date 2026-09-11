import { describe, expect, it } from 'vitest'
import { markOfFile, type FileTouch } from '../../../src/domain/File/FileMark.js'
import type { StoryState } from '../../../src/domain/Story/Story.js'

function touch(state: StoryState, storyReference = 'FORGE-3', agentName: string | null = 'neo'): FileTouch {
  return { storyReference, storyState: state, agentName }
}

describe('markOfFile', () => {
  it('laisse tranquille un fichier qu aucune story ne touche', () => {
    expect(markOfFile({ onDisk: true, touches: [] })).toEqual({ mark: 'quiet', said: '', byReferences: [] })
  })

  it('annonce en orange le fichier qu une session est en train de modifier', () => {
    expect(markOfFile({ onDisk: true, touches: [touch('building')] })).toEqual({
      mark: 'planned',
      said: 'FORGE-3 le modifie, session neo',
      byReferences: ['FORGE-3'],
    })
  })

  it('distingue un fichier que la session cree d un fichier supprime', () => {
    expect(markOfFile({ onDisk: false, touches: [touch('building')] }).mark).toBe('created')
    expect(markOfFile({ onDisk: false, touches: [touch('done')] }).mark).toBe('deleted')
  })

  it('passe au vert quand le travail est fait mais pas encore merge', () => {
    expect(markOfFile({ onDisk: true, touches: [touch('shipping')] })).toEqual({
      mark: 'ready',
      said: 'FORGE-3 l a fini, en attente de merge',
      byReferences: ['FORGE-3'],
    })
  })

  it('redevient calme une fois la story en prod', () => {
    expect(markOfFile({ onDisk: true, touches: [touch('done')] }).mark).toBe('merged')
  })

  it('nomme toutes les stories quand plusieurs se disputent le fichier', () => {
    const verdict = markOfFile({
      onDisk: true,
      touches: [touch('building', 'FORGE-3'), touch('reviewing', 'MAILER-2', null)],
    })
    expect(verdict.byReferences).toEqual(['FORGE-3', 'MAILER-2'])
    expect(verdict.said).toBe('FORGE-3 et MAILER-2 le modifient')
  })

  it('fait primer le travail en cours sur le travail deja fini', () => {
    expect(markOfFile({ onDisk: true, touches: [touch('done'), touch('building', 'FORGE-9')] }).mark).toBe(
      'planned',
    )
  })
})
