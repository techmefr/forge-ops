import { realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { assertCheckoutPath, CheckoutPathRefusedError } from '../Story/CheckoutPath.js'
import type { FileTouch } from './FileMark.js'
import type { FileRepository } from './FileRepository.js'

export const identifierSchema = z.coerce.number().int().positive()

export type Holder = {
  checkoutPath: string
  touches: Map<string, readonly FileTouch[]>
}

export type Refused = { refused: string }

export type HolderLookup = Holder | 'unknown-project' | 'unknown-checkout' | Refused

export type HolderResolver = ReturnType<typeof createHolderResolver>

function realOf(path: string): string {
  try {
    return realpathSync(resolve(path))
  } catch {
    return resolve(path)
  }
}

export function holdsServerData(checkoutPath: string, serverPaths: readonly string[]): boolean {
  const checkout = realOf(checkoutPath)
  return serverPaths.some((served) => {
    const inside = relative(checkout, realOf(served))
    return inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))
  })
}

export function saidBy(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function outsideRoots(holder: Holder | Refused): holder is Refused {
  return 'refused' in holder
}

type ResolverInput = {
  stories: StoryRepository
  files: FileRepository
  checkoutRoots: readonly string[]
  serverPaths: readonly string[]
}

export function createHolderResolver({ stories, files, checkoutRoots, serverPaths }: ResolverInput) {
  function holderOf(rawId: string): HolderLookup {
    const projectId = identifierSchema.safeParse(rawId)
    if (!projectId.success) {
      return 'unknown-project'
    }
    const project = stories.listProjects().find((known) => known.id === projectId.data)
    if (project === undefined) {
      return 'unknown-project'
    }
    if (project.checkoutPath === null || project.checkoutPath === '') {
      return 'unknown-checkout'
    }
    try {
      assertCheckoutPath(project.checkoutPath, checkoutRoots)
    } catch (error) {
      return { refused: error instanceof CheckoutPathRefusedError ? error.message : saidBy(error) }
    }
    if (holdsServerData(project.checkoutPath, serverPaths)) {
      return { refused: 'the checkout contains the server data' }
    }
    return { checkoutPath: project.checkoutPath, touches: files.touchesOfProject(projectId.data) }
  }

  return { holderOf }
}
