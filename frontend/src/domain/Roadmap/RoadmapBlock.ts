import type { Extent, LabelPlacement, RoadmapSubject, SubjectBar } from './Timeline'
import type { RoadmapProject } from './UseRoadmap'

export type SubjectRow = {
  subject: RoadmapSubject
  bar: SubjectBar
  extent: Extent
  placement: LabelPlacement
  toWrite: boolean
}

export type ProjectBlock = {
  entry: RoadmapProject
  rows: readonly SubjectRow[]
  undated: readonly RoadmapSubject[]
  lateCount: number
  toWriteCount: number
  lanes: ReadonlyMap<number, number>
  labelled: ReadonlySet<number>
  height: number
}
