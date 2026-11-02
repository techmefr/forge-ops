import type { Hono } from 'hono'
import { createBatchApi } from '../domain/Delivery/BatchApi.js'
import type { BatchRepository } from '../domain/Delivery/BatchRepository.js'
import { createBoundaryApi } from '../domain/Boundary/BoundaryApi.js'
import type { OutboxRepository } from '../domain/Boundary/OutboxRepository.js'
import { createDriverApi } from '../domain/Driver/DriverApi.js'
import { readAllowedDomains } from '../domain/Identity/ExternalIdentity.js'
import { createIdentityApi } from '../domain/Identity/IdentityApi.js'
import type { IdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createOidcApi } from '../domain/Identity/OidcApi.js'
import { createOrganisationApi } from '../domain/Organisation/OrganisationApi.js'
import type { OrganisationRepository } from '../domain/Organisation/OrganisationRepository.js'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import { createTemplateApi } from '../domain/Template/TemplateApi.js'
import type { TemplateRepository } from '../domain/Template/TemplateRepository.js'
import { createProjectWorkflowApi } from '../domain/Workflow/ProjectWorkflowApi.js'
import type { ProjectWorkflowRepository } from '../domain/Workflow/ProjectWorkflowRepository.js'
import { createWorkflowColumnApi } from '../domain/Workflow/WorkflowColumnApi.js'
import type { WorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import { readOidcProviders } from '../technical/Auth/OidcProvider.js'
import { installedVersion, offeredVersion } from '../technical/Version/ForgeVersion.js'
import type { AgentDriver } from '../domain/Driver/Driver.js'
import type { BoardAccess } from './BoardAccess.js'

export type AdministrationRoutesInput = {
  mode: 'local' | 'hub'
  publicOrigin: string | null
  setupToken: string | null
  identities: IdentityRepository
  stories: StoryRepository
  access: BoardAccess
  drivers: readonly AgentDriver[]
  outbox: OutboxRepository
  organisations: OrganisationRepository
  batches: BatchRepository
  templates: TemplateRepository
  projectWorkflows: ProjectWorkflowRepository
  workflowColumns: WorkflowColumnRepository
}

export function mountAdministrationRoutes(
  app: Hono,
  {
    mode,
    publicOrigin,
    setupToken,
    identities,
    stories,
    access,
    drivers,
    outbox,
    organisations,
    batches,
    templates,
    projectWorkflows,
    workflowColumns,
  }: AdministrationRoutesInput,
): void {
  app.route(
    '/',
    createIdentityApi({
      identities,
      allowEnrolment: () => identities.countUsers() === 0 && (mode !== 'hub' || setupToken !== null),
      setupToken,
    }),
  )
  app.route(
    '/',
    createOidcApi({
      identities,
      providers: readOidcProviders(),
      allowedDomains: readAllowedDomains(),
      publicOrigin,
    }),
  )
  app.route('/', createDriverApi({ drivers }))
  app.route(
    '/',
    createBoundaryApi({
      outbox,
      installedVersion: installedVersion(),
      offeredVersion,
    }),
  )
  app.route('/', createOrganisationApi({ organisations, maySettle: access.maySettle }))
  app.route('/', createBatchApi({ batches, maySettle: access.maySettle }))
  app.route('/', createTemplateApi({ templates, maySettle: access.maySettle }))
  app.route(
    '/',
    createProjectWorkflowApi({
      workflows: projectWorkflows,
      projectExists: (projectId) => stories.projects.find(projectId) !== null,
      mayAdminister: access.mayAdminister,
    }),
  )
  app.route(
    '/',
    createWorkflowColumnApi({
      columns: workflowColumns,
      projectExists: (projectId) => stories.projects.find(projectId) !== null,
      mayAdminister: access.mayAdminister,
      adminOf: (projectId) => {
        const sheet = stories.projects.find(projectId)
        return sheet === null || sheet.adminLogin === null
          ? null
          : { login: sheet.adminLogin, name: sheet.adminName ?? sheet.adminLogin }
      },
    }),
  )
}
