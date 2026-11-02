import { Hono } from 'hono'
import type { Context } from 'hono'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { createCodeRenderer, type CodeRenderer } from '../../technical/File/CodeRender.js'
import { createHighlightCache, type HighlightCache } from '../../technical/File/HighlightCache.js'
import { mountFileAdminRoutes } from './FileAdminRoutes.js'
import { createHolderResolver } from './FileHolder.js'
import { mountFileReadRoute } from './FileReadRoutes.js'
import type { FileRepository } from './FileRepository.js'
import { mountFileTreeRoutes } from './FileTreeRoutes.js'

export type FileApiInput = {
  stories: StoryRepository
  files: FileRepository
  maxFileBytes?: number
  maxWalkedFiles?: number
  checkoutRoots?: readonly string[]
  serverPaths?: readonly string[]
  mayAdminister: (projectId: number, context: Context) => boolean
  installGuardrails?: (checkoutPath: string) => { settingsPath: string; localSettingsPath: string | null }
  codeRenderer?: CodeRenderer
  highlightCache?: HighlightCache<{ html: string; known: boolean }>
}

const DEFAULT_MAX_FILE_BYTES = 200_000
const DEFAULT_MAX_WALKED_FILES = 4000

export function createFileApi({
  stories,
  files,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxWalkedFiles = DEFAULT_MAX_WALKED_FILES,
  checkoutRoots = [process.cwd()],
  serverPaths = [],
  mayAdminister,
  installGuardrails,
  codeRenderer = createCodeRenderer(),
  highlightCache = createHighlightCache(),
}: FileApiInput): Hono {
  const api = new Hono()
  const resolver = createHolderResolver({ stories, files, checkoutRoots, serverPaths })
  mountFileTreeRoutes(api, resolver, maxWalkedFiles)
  mountFileReadRoute(api, resolver, { maxFileBytes, codeRenderer, highlightCache })
  mountFileAdminRoutes(api, resolver, { stories, mayAdminister, installGuardrails, serverPaths })
  return api
}
