export class EmptyRemarkError extends Error {
  constructor(reference: string) {
    super(`An empty remark adds nothing to the discussion of ${reference}`)
    this.name = 'EmptyRemarkError'
  }
}

export class StoryAlreadyHeldError extends Error {
  constructor(reference: string) {
    super(`Story ${reference} is already blocked, answer in the thread to free it`)
    this.name = 'StoryAlreadyHeldError'
  }
}
