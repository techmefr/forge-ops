import type Database from 'better-sqlite3'
import type { Tag, TagDraft } from '../../../../contract/EpicContract.js'
import { TagInUseError, TagLabelTakenError, TagNotFoundError } from './EpicViolation.js'

export type TagRow = { id: number; label: string; colour: string; usage: number }

export type TagCatalog = {
  listTags: () => readonly Tag[]
  createTag: (draft: TagDraft) => Tag
  updateTag: (tagId: number, draft: TagDraft) => Tag
  deleteTag: (tagId: number) => void
}

export function createTagCatalog(db: Database.Database): TagCatalog {
  const selectTagByLabel = db.prepare<[string], { id: number }>('SELECT id FROM tag WHERE label = ?')
  const insertTag = db.prepare<[string, string]>('INSERT INTO tag (label, colour) VALUES (?, ?)')
  const updateTag = db.prepare<[string, string, number]>('UPDATE tag SET label = ?, colour = ? WHERE id = ?')
  const deleteTag = db.prepare<[number]>('DELETE FROM tag WHERE id = ?')
  const selectTags = db.prepare<[], TagRow>(
    `SELECT tag.id, tag.label, tag.colour, COUNT(epic_tag.epic_id) AS usage
       FROM tag LEFT JOIN epic_tag ON epic_tag.tag_id = tag.id
      GROUP BY tag.id ORDER BY tag.label`,
  )
  const selectTagById = db.prepare<[number], TagRow>(
    `SELECT tag.id, tag.label, tag.colour, COUNT(epic_tag.epic_id) AS usage
       FROM tag LEFT JOIN epic_tag ON epic_tag.tag_id = tag.id
      WHERE tag.id = ? GROUP BY tag.id`,
  )

  function assertLabelFree(label: string, ownId: number | null): void {
    const taken = selectTagByLabel.get(label)
    if (taken !== undefined && taken.id !== ownId) {
      throw new TagLabelTakenError(label)
    }
  }

  function tagById(tagId: number): Tag {
    const row = selectTagById.get(tagId)
    if (row === undefined) {
      throw new TagNotFoundError(tagId)
    }
    return { id: row.id, label: row.label, colour: row.colour, usage: row.usage }
  }

  return {
    listTags: () => selectTags.all().map(({ id, label, colour, usage }) => ({ id, label, colour, usage })),

    createTag: (draft) => {
      assertLabelFree(draft.label, null)
      const info = insertTag.run(draft.label, draft.colour)
      return tagById(Number(info.lastInsertRowid))
    },

    updateTag: (tagId, draft) => {
      tagById(tagId)
      assertLabelFree(draft.label, tagId)
      updateTag.run(draft.label, draft.colour, tagId)
      return tagById(tagId)
    },

    deleteTag: (tagId) => {
      const tag = tagById(tagId)
      if (tag.usage > 0) {
        throw new TagInUseError(tagId, tag.usage)
      }
      deleteTag.run(tagId)
    },
  }
}
