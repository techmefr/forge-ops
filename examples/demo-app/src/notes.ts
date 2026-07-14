import { randomUUID } from 'node:crypto'
import type { INote } from './types.js'

export class NotesStore {
  private readonly notes: Map<string, INote> = new Map()

  create(title: string, body: string): INote {
    const isTitleEmpty = title.trim().length === 0
    if (isTitleEmpty) {
      throw new Error('Le titre ne peut pas etre vide')
    }
    const note: INote = {
      id: randomUUID(),
      title,
      body,
      createdAt: new Date().toISOString(),
    }
    this.notes.set(note.id, note)
    return note
  }

  list(): INote[] {
    return [...this.notes.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  get(id: string): INote | null {
    return this.notes.get(id) ?? null
  }

  remove(id: string): boolean {
    return this.notes.delete(id)
  }
}
