import { describe, expect, it } from 'vitest'
import { NotesStore } from '../src/notes.js'

describe('NotesStore', () => {
  it('creates a note with an id and a timestamp', () => {
    const store = new NotesStore()
    const note = store.create('Courses', 'Lait, oeufs, pain')
    expect(note.id).toBeTruthy()
    expect(note.title).toBe('Courses')
    expect(note.createdAt).toBeTruthy()
  })

  it('rejects an empty title', () => {
    const store = new NotesStore()
    expect(() => store.create('   ', 'body')).toThrow()
  })

  it('lists notes ordered by creation date', () => {
    const store = new NotesStore()
    const first = store.create('Premiere', '')
    const second = store.create('Deuxieme', '')
    expect(store.list().map((note) => note.id)).toEqual([first.id, second.id])
  })

  it('gets a note by id, returns null when absent', () => {
    const store = new NotesStore()
    const note = store.create('Titre', 'Corps')
    expect(store.get(note.id)).toEqual(note)
    expect(store.get('inconnu')).toBeNull()
  })

  it('removes a note by id', () => {
    const store = new NotesStore()
    const note = store.create('Titre', 'Corps')
    expect(store.remove(note.id)).toBe(true)
    expect(store.get(note.id)).toBeNull()
    expect(store.remove(note.id)).toBe(false)
  })
})
