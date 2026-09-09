export class WorktreeViolationError extends Error {}

export class BranchNameRefusedError extends WorktreeViolationError {
  constructor(reference: string) {
    super(`la reference ${reference} ne donne aucun nom de branche utilisable`)
    this.name = 'BranchNameRefusedError'
  }
}

export class WorktreeAlreadyLiveError extends WorktreeViolationError {
  constructor(reference: string, branchName: string) {
    super(`${reference} travaille deja sur ${branchName}`)
    this.name = 'WorktreeAlreadyLiveError'
  }
}

export class WorktreeNotFoundError extends WorktreeViolationError {
  constructor(reference: string) {
    super(`aucun worktree ouvert pour ${reference}`)
    this.name = 'WorktreeNotFoundError'
  }
}

export class WorktreeNotRemovableError extends WorktreeViolationError {
  constructor(branchName: string, reason: string) {
    super(`le worktree ${branchName} n a pas pu etre retire : ${reason}`)
    this.name = 'WorktreeNotRemovableError'
  }
}
