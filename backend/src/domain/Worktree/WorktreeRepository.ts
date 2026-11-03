import type Database from 'better-sqlite3'
import { resolve } from 'node:path'
import { GitCommandFailedError } from '../../technical/Git/GitWorktree.js'
import { isPortBindable } from '../../technical/Network/PortProbe.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { branchNameFor, worktreeFolderFor } from './Branch.js'
import type { GitWorktreeRunner, Worktree, WorktreeOrder } from './Worktree.js'
import { createWorktreePorts } from './WorktreePorts.js'
import { prepareWorktreeStatements, toWorktree, type WorktreeStatements } from './WorktreeStatements.js'
import { WorktreeAlreadyLiveError, WorktreeNotFoundError, WorktreeNotRemovableError } from './WorktreeViolation.js'

export type WorktreeRepository = {
  open: (order: WorktreeOrder) => Worktree
  close: (storyId: number, options?: { force?: boolean; deleteBranch?: boolean }) => void
  findForStory: (storyId: number) => Worktree | null
  listLive: () => readonly Worktree[]
}

export type WorktreeRepositoryInput = {
  stories: StoryRepository
  git: GitWorktreeRunner
  root: string
  checkoutOf?: (storyId: number) => string
  isPortFree?: (port: number) => boolean
}

type WorktreeContext = Omit<WorktreeRepositoryInput, 'isPortFree'> & {
  db: Database.Database
  statements: WorktreeStatements
  freePortFor: (branch: string, worktreeId: number) => number
}

function openWorktree(context: WorktreeContext, order: WorktreeOrder): Worktree {
  const { db, statements, stories, git, root, checkoutOf, freePortFor } = context
  const { selectLiveForStory, selectRowForStory, insertWorktree, reopenWorktree, dropReservation, insertReservation } =
    statements
  return db.transaction(() => {
    const story = stories.findStory(order.storyId)
    if (selectLiveForStory.get(order.storyId) !== undefined) {
      throw new WorktreeAlreadyLiveError(story.reference, branchNameFor(story.reference, story.title))
    }
    const branch = branchNameFor(story.reference, story.title)
    const folder = worktreeFolderFor(branch)
    const path = resolve(root, folder)
    const repositoryRoot = checkoutOf?.(order.storyId)
    const baseSha = git.headSha(order.baseRef, repositoryRoot)

    const existing = selectRowForStory.get(order.storyId)
    if (existing === undefined) {
      insertWorktree.run(order.storyId, order.forgeCardId ?? null, path, branch, order.baseRef, baseSha)
    } else {
      reopenWorktree.run(path, branch, baseSha, order.forgeCardId ?? null, existing.id)
    }
    const written = selectRowForStory.get(order.storyId)
    if (written === undefined) {
      throw new WorktreeNotFoundError(story.reference)
    }

    const port = freePortFor(branch, written.id)
    dropReservation.run(written.id)
    insertReservation.run(port, written.id, folder)

    git.addWorktree({ path, branch, baseRef: order.baseRef }, repositoryRoot)

    const live = selectLiveForStory.get(order.storyId)
    if (live === undefined) {
      throw new WorktreeNotFoundError(story.reference)
    }
    return toWorktree(live)
  })()
}

function closeWorktree(
  context: WorktreeContext,
  storyId: number,
  options: { force?: boolean; deleteBranch?: boolean },
): void {
  const { statements, stories, git, checkoutOf } = context
  const story = stories.findStory(storyId)
  const live = statements.selectLiveForStory.get(storyId)
  if (live === undefined) {
    throw new WorktreeNotFoundError(story.reference)
  }
  if (options.force !== true && git.isDirty(live.path)) {
    throw new WorktreeNotRemovableError(live.branch, 'du travail non commite y dort encore')
  }
  const repositoryRoot = checkoutOf?.(storyId)
  git.removeWorktree(live.path, repositoryRoot)
  statements.releaseReservation.run(live.id)
  statements.markRemoved.run(live.id)
  if (options.deleteBranch === true) {
    try {
      git.deleteBranch(live.branch, repositoryRoot)
    } catch (error) {
      if (!(error instanceof GitCommandFailedError)) {
        throw error
      }
    }
  }
}

export function createWorktreeRepository(
  db: Database.Database,
  { stories, git, root, checkoutOf, isPortFree = isPortBindable }: WorktreeRepositoryInput,
): WorktreeRepository {
  const statements = prepareWorktreeStatements(db)
  const freePortFor = createWorktreePorts(statements, isPortFree)
  const context: WorktreeContext = { db, statements, stories, git, root, checkoutOf, freePortFor }

  return {
    open: (order) => openWorktree(context, order),
    close: (storyId, options = {}) => closeWorktree(context, storyId, options),
    findForStory: (storyId) => {
      const live = statements.selectLiveForStory.get(storyId)
      return live === undefined ? null : toWorktree(live)
    },
    listLive: () => statements.selectLive.all().map(toWorktree),
  }
}
