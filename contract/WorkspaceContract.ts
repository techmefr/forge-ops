export type Zone = {
  id: number
  projectId: number
  pathPrefix: string
  name: string
  colour: string
  summary: string | null
}

export type ZoneFile = {
  path: string
  storyReference: string
  agentName: string | null
}

export type ZoneOverview = {
  zone: Zone
  files: readonly ZoneFile[]
  storyCount: number
}

export type PathConflict = {
  path: string
  storyIds: readonly number[]
}

export type Worktree = {
  id: number
  storyId: number
  storyReference: string
  forgeCardId: number | null
  path: string
  branch: string
  baseRef: string
  baseSha: string
  port: number
  subdomain: string
  createdAt: string
}

export type MergeCleanupReport = {
  scopesReleased: number
  worktreeClosed: boolean
  worktreeRefusal: string | null
}

export type ScopeClaim = {
  storyId: number
  pathPrefix: string
  symbols: readonly string[]
}

export type ScopeReservation = ScopeClaim & {
  id: number
  storyReference: string
  reservedAt: string
}

export type ScopeCollision = {
  storyIds: readonly number[]
  reason: string
}
