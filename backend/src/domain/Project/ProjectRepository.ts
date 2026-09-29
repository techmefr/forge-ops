import type Database from 'better-sqlite3'
import type { ProjectSheet, ProjectUpdate } from '../../../../contract/ProjectContract.js'
import type { EpicRepository } from '../Epic/EpicRepository.js'
import { ProjectAdminRefusedError, ProjectInUseError } from '../Epic/EpicViolation.js'
import { ProjectNotFoundError } from '../Story/StoryViolation.js'

type SheetRow = {
  id: number
  slug: string
  name: string
  colour: string
  position: number
  admin_user_id: number | null
  admin_login: string | null
  admin_name: string | null
  usage: number
}

export type ProjectRepository = {
  list: () => readonly ProjectSheet[]
  find: (projectId: number) => ProjectSheet | null
  update: (projectId: number, patch: ProjectUpdate) => ProjectSheet
  remove: (projectId: number) => void
}

export type ProjectRepositoryInput = {
  epics: EpicRepository
}

const SHEET_QUERY = `SELECT project.id, project.slug, project.name, project.colour, project.position,
         project.admin_user_id, board_user.login AS admin_login, board_user.display_name AS admin_name,
         (SELECT COUNT(*) FROM epic WHERE epic.project_id = project.id) AS usage
    FROM project LEFT JOIN board_user ON board_user.id = project.admin_user_id`

export function createProjectRepository(
  db: Database.Database,
  { epics }: ProjectRepositoryInput,
): ProjectRepository {
  const selectSheets = db.prepare<[], SheetRow>(`${SHEET_QUERY} ORDER BY project.position, project.name`)
  const selectSheet = db.prepare<[number], SheetRow>(`${SHEET_QUERY} WHERE project.id = ?`)
  const selectUser = db.prepare<[number], { disabled_at: string | null }>(
    'SELECT disabled_at FROM board_user WHERE id = ?',
  )
  const updateColour = db.prepare<[string, number]>('UPDATE project SET colour = ? WHERE id = ?')
  const updatePosition = db.prepare<[number, number]>('UPDATE project SET position = ? WHERE id = ?')
  const selectOrder = db.prepare<[], { id: number }>('SELECT id FROM project ORDER BY position, name, id')
  const updateAdmin = db.prepare<[number | null, number]>('UPDATE project SET admin_user_id = ? WHERE id = ?')
  const selectAdmin = db.prepare<[number], { admin_user_id: number | null }>(
    'SELECT admin_user_id FROM project WHERE id = ?',
  )
  const deleteLinks = db.prepare<[number]>('DELETE FROM project_link WHERE project_id = ?')
  const deleteTemplate = db.prepare<[number]>('DELETE FROM project_template WHERE project_id = ?')
  const deleteRisks = db.prepare<[number]>('DELETE FROM project_risk WHERE project_id = ?')
  const deleteDecisions = db.prepare<[number]>('DELETE FROM project_decision WHERE project_id = ?')
  const deleteZones = db.prepare<[number]>('DELETE FROM zone WHERE project_id = ?')
  const deleteBatchStories = db.prepare<[number]>(
    'DELETE FROM batch_story WHERE batch_id IN (SELECT id FROM merge_batch WHERE project_id = ?)',
  )
  const deleteBatches = db.prepare<[number]>('DELETE FROM merge_batch WHERE project_id = ?')
  const deleteProject = db.prepare<[number]>('DELETE FROM project WHERE id = ?')

  function sheetOf(row: SheetRow): ProjectSheet {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      colour: row.colour,
      position: row.position,
      adminUserId: row.admin_user_id,
      adminLogin: row.admin_login,
      adminName: row.admin_name,
      links: epics.projectLinks(row.id),
      usage: row.usage,
    }
  }

  function demand(projectId: number): ProjectSheet {
    const row = selectSheet.get(projectId)
    if (row === undefined) {
      throw new ProjectNotFoundError(projectId)
    }
    return sheetOf(row)
  }

  function assertAdministrable(projectId: number, userId: number): void {
    if (selectAdmin.get(projectId)?.admin_user_id === userId) {
      return
    }
    const user = selectUser.get(userId)
    if (user === undefined || user.disabled_at !== null) {
      throw new ProjectAdminRefusedError(userId)
    }
  }

  function moveTo(projectId: number, position: number): void {
    const others = selectOrder.all().filter((row) => row.id !== projectId)
    const target = Math.min(position, others.length)
    const ordered = [...others.slice(0, target), { id: projectId }, ...others.slice(target)]
    ordered.forEach((row, index) => updatePosition.run(index, row.id))
  }

  const write = db.transaction((projectId: number, patch: ProjectUpdate) => {
    demand(projectId)
    if (patch.adminId !== undefined && patch.adminId !== null) {
      assertAdministrable(projectId, patch.adminId)
    }
    if (patch.colour !== undefined) {
      updateColour.run(patch.colour, projectId)
    }
    if (patch.position !== undefined) {
      moveTo(projectId, patch.position)
    }
    if (patch.adminId !== undefined) {
      updateAdmin.run(patch.adminId, projectId)
    }
    if (patch.links !== undefined) {
      epics.setProjectLinks(projectId, patch.links)
    }
  })

  const erase = db.transaction((projectId: number) => {
    const sheet = demand(projectId)
    if (sheet.usage > 0) {
      throw new ProjectInUseError(projectId, sheet.usage)
    }
    deleteLinks.run(projectId)
    deleteTemplate.run(projectId)
    deleteRisks.run(projectId)
    deleteDecisions.run(projectId)
    deleteZones.run(projectId)
    deleteBatchStories.run(projectId)
    deleteBatches.run(projectId)
    deleteProject.run(projectId)
  })

  return {
    list: () => selectSheets.all().map(sheetOf),

    find: (projectId) => {
      const row = selectSheet.get(projectId)
      return row === undefined ? null : sheetOf(row)
    },

    update: (projectId, patch) => {
      write(projectId, patch)
      return demand(projectId)
    },

    remove: (projectId) => {
      erase(projectId)
    },
  }
}
