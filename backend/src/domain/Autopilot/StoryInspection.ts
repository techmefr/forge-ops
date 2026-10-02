export type { ChangedFile, StoryInspection, TestRun } from '../../../../contract/StoryInspectionContract.js'

const TEST_PATH = [
  /(^|\/)(test|tests|__tests__|spec|specs)\//i,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /_test\.(go|py|rb|php)$/,
  /(^|\/)test_[^/]+\.py$/,
  /Tests?\.(php|java|cs|kt)$/,
]

const CODE_PATH = /\.(?:[cm]?[jt]sx?|vue|py|go|rs|java|kt|php|rb|cs|swift|c|cc|cpp|h|hpp)$/

export function isTestPath(path: string): boolean {
  return TEST_PATH.some((pattern) => pattern.test(path))
}

export function isProductionCode(path: string): boolean {
  return CODE_PATH.test(path) && !isTestPath(path)
}
