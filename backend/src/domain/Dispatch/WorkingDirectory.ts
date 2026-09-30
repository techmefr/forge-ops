import { CheckoutMissingError } from './DispatchViolation.js'

export function workingDirectoryOf(
  worktreePath: string | null,
  checkoutPath: string | null | undefined,
  projectName: string,
): string {
  if (worktreePath !== null) {
    return worktreePath
  }
  if (checkoutPath === null || checkoutPath === undefined || checkoutPath === '') {
    throw new CheckoutMissingError(projectName)
  }
  return checkoutPath
}
