import type Database from 'better-sqlite3'
import type { LinkKind, SubjectLink } from '../../../../contract/EpicContract.js'
import { ProjectNotFoundError } from '../Story/StoryViolation.js'

export type ProjectLinkCatalog = {
  projectLinks: (projectId: number) => readonly SubjectLink[]
  setProjectLinks: (projectId: number, links: readonly SubjectLink[]) => void
}

export function createProjectLinkCatalog(db: Database.Database): ProjectLinkCatalog {
  const selectProject = db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const deleteProjectLinks = db.prepare<[number]>('DELETE FROM project_link WHERE project_id = ?')
  const insertProjectLink = db.prepare<[number, LinkKind, string]>(
    'INSERT INTO project_link (project_id, kind, url) VALUES (?, ?, ?)',
  )
  const selectProjectLinks = db.prepare<[number], { kind: LinkKind; url: string }>(
    'SELECT kind, url FROM project_link WHERE project_id = ? ORDER BY id',
  )

  function assertProject(projectId: number): void {
    if (selectProject.get(projectId) === undefined) {
      throw new ProjectNotFoundError(projectId)
    }
  }

  return {
    projectLinks: (projectId) => {
      assertProject(projectId)
      return selectProjectLinks.all(projectId)
    },

    setProjectLinks: (projectId, links) => {
      assertProject(projectId)
      db.transaction(() => {
        deleteProjectLinks.run(projectId)
        links.forEach((link) => insertProjectLink.run(projectId, link.kind, link.url))
      })()
    },
  }
}
