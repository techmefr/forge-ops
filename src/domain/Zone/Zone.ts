export type Zone = {
  id: number
  projectId: number
  pathPrefix: string
  name: string
  colour: string
  summary: string | null
}

export type ZoneDraft = {
  projectId: number
  pathPrefix: string
  name: string
  colour: string
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
