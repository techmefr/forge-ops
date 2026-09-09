import { BranchNameRefusedError } from './WorktreeViolation.js'

export const BRANCH_PREFIX = 'story'

export const BRANCH_MAX_LENGTH = 80

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function trimSeparators(value: string): string {
  return value.replace(/-+$/g, '')
}

export function branchNameFor(reference: string, title: string): string {
  const slug = slugify(reference)
  if (slug === '') {
    throw new BranchNameRefusedError(reference.trim() === '' ? '(vide)' : reference)
  }
  const named = slugify(title)
  const tail = named === '' ? slug : `${slug}-${named}`
  const full = `${BRANCH_PREFIX}/${tail}`
  return full.length <= BRANCH_MAX_LENGTH ? full : trimSeparators(full.slice(0, BRANCH_MAX_LENGTH))
}

export function worktreeFolderFor(branchName: string): string {
  return slugify(branchName)
}
