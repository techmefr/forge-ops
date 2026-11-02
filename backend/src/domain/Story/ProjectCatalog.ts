import type Database from 'better-sqlite3'
import type { Project, ProjectDraft } from './Story.js'
import { assertCheckoutPath } from './CheckoutPath.js'
import { ProjectNotFoundError, ProjectSlugTakenError } from './StoryViolation.js'

export type ProjectCatalog = {
  createProject: (draft: ProjectDraft) => Project
  listProjects: () => readonly Project[]
  setCheckoutPath: (projectId: number, checkoutPath: string) => Project
}

type ProjectRow = {
  id: number
  slug: string
  name: string
  repository_url: string
  integration_branch: string
  colour: string
  checkout_path: string | null
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    repositoryUrl: row.repository_url,
    integrationBranch: row.integration_branch,
    colour: row.colour,
    checkoutPath: row.checkout_path,
  }
}

export function createProjectCatalog(db: Database.Database, checkoutRoots: readonly string[]): ProjectCatalog {
  const insertProject = db.prepare<[string, string, string, string, string, string | null]>(
    'INSERT INTO project (slug, name, repository_url, integration_branch, colour, checkout_path, position) VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM project))',
  )
  const updateCheckoutPath = db.prepare<[string, number]>('UPDATE project SET checkout_path = ? WHERE id = ?')
  const selectProjects = db.prepare<[], ProjectRow>('SELECT * FROM project ORDER BY position, name')
  const selectProjectById = db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const selectProjectBySlug = db.prepare<[string], { id: number }>('SELECT id FROM project WHERE slug = ?')

  function listProjects(): readonly Project[] {
    return selectProjects.all().map(toProject)
  }

  return {
    createProject: (draft) => {
      if (selectProjectBySlug.get(draft.slug) !== undefined) {
        throw new ProjectSlugTakenError(draft.slug)
      }
      const checkoutPath =
        draft.checkoutPath === undefined || draft.checkoutPath === null
          ? null
          : assertCheckoutPath(draft.checkoutPath, checkoutRoots)
      const info = insertProject.run(
        draft.slug,
        draft.name,
        draft.repositoryUrl,
        draft.integrationBranch,
        draft.colour,
        checkoutPath,
      )
      return { id: Number(info.lastInsertRowid), ...draft, checkoutPath }
    },

    listProjects,

    setCheckoutPath: (projectId, checkoutPath) => {
      if (selectProjectById.get(projectId) === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      updateCheckoutPath.run(assertCheckoutPath(checkoutPath, checkoutRoots), projectId)
      const found = listProjects().find((project) => project.id === projectId)
      if (found === undefined) {
        throw new ProjectNotFoundError(projectId)
      }
      return found
    },
  }
}
