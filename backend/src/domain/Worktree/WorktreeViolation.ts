export class WorktreeViolationError extends Error {}

export class BranchNameRefusedError extends WorktreeViolationError {
  constructor(reference: string) {
    super(`reference ${reference} yields no usable branch name`)
    this.name = 'BranchNameRefusedError'
  }
}

export class WorktreeAlreadyLiveError extends WorktreeViolationError {
  constructor(reference: string, branchName: string) {
    super(`${reference} is already working on ${branchName}`)
    this.name = 'WorktreeAlreadyLiveError'
  }
}

export class WorktreeNotFoundError extends WorktreeViolationError {
  constructor(reference: string) {
    super(`no open worktree for ${reference}`)
    this.name = 'WorktreeNotFoundError'
  }
}

export class WorktreeNotRemovableError extends WorktreeViolationError {
  constructor(branchName: string, reason: string) {
    super(`worktree ${branchName} could not be removed: ${reason}`)
    this.name = 'WorktreeNotRemovableError'
  }
}
