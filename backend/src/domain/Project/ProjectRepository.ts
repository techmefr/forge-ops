import type Database from 'better-sqlite3'
import type { ProjectSheet, ProjectUpdate } from '../../../../contract/ProjectContract.js'
import type { EpicRepository } from '../Epic/EpicRepository.js'
import { ProjectAdminRefusedError, ProjectInUseError } from '../Epic/EpicViolation.js'
import { ProjectNotFoundError } from '../Story/StoryViolation.js'
import { deleteProjectRows, prepareProjectStatements, type SheetRow } from './ProjectStatements.js'

export type ProjectRepository = {
  list: () => readonly ProjectSheet[]
  find: (projectId: number) => ProjectSheet | null
  update: (projectId: number, patch: ProjectUpdate) => ProjectSheet
  remove: (projectId: number) => void
}

export type ProjectRepositoryInput = {
  epics: EpicRepository
}

export function createProjectRepository(
  db: Database.Database,
  { epics }: ProjectRepositoryInput,
): ProjectRepository {
  const statements = prepareProjectStatements(db)
  const { selectSheets, selectSheet, selectUser, updateColour, updatePosition, selectOrder, updateAdmin, selectAdmin } =
    statements

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
    deleteProjectRows(statements, projectId)
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
