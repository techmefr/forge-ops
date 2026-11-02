import type Database from 'better-sqlite3'
import type { Story, StoryDraft, StoryState, TwinDraft } from './Story.js'
import type { HumanGateWait } from './HumanGate.js'
import { createEpicRepository, type EpicRepository } from '../Epic/EpicRepository.js'
import { createEventRepository, type EventRepository } from '../Event/EventRepository.js'
import { createProjectRepository, type ProjectRepository } from '../Project/ProjectRepository.js'
import { createFollowUpRepository, type FollowUpRepository } from '../FollowUp/FollowUpRepository.js'
import { createDependencyRepository, type DependencyRepository } from './DependencyRepository.js'
import { createEpicCatalog, type EpicCatalog } from './EpicCatalog.js'
import { createMilestoneRepository, type MilestoneRepository } from './MilestoneRepository.js'
import { createProjectCatalog, type ProjectCatalog } from './ProjectCatalog.js'
import { createStepBackRepository, type StepBackRepository } from './StepBackRepository.js'
import { createStoryAuthoring } from './StoryAuthoring.js'
import { createStoryFlow, type StoryPlacement } from './StoryFlow.js'
import { createStoryQueries } from './StoryQueries.js'
import { createStoryRegistry } from './StoryRegistry.js'
import { prepareStoryStatements } from './StoryStatements.js'
import type { StepBackDraft, StepBackRecord } from './StepBack.js'

export type { CardContext } from './MilestoneRepository.js'
export type { StoryPlacement } from './StoryFlow.js'

export type StoryRepository = ProjectCatalog &
  EpicCatalog &
  MilestoneRepository &
  Pick<DependencyRepository, 'addDependency' | 'listBlockers'> & {
    epics: EpicRepository
    agenda: EventRepository
    projects: ProjectRepository
    followUps: FollowUpRepository
    listHumanGateWaits: () => readonly HumanGateWait[]
    projectOfStory: (storyId: number) => number
    writeStory: (draft: StoryDraft) => Story
    writeTwin: (draft: TwinDraft) => Story
    findStory: (storyId: number) => Story
    findTwin: (storyId: number) => Story | null
    sendToBacklog: (storyId: number) => Story
    markDoneAndUnblock: (storyId: number) => readonly Story[]
    startBuilding: (storyId: number) => Story
    moveToState: (storyId: number, state: StoryState) => Story
    setPlacement: (storyId: number, placement: StoryPlacement) => Story
    stepBack: (draft: StepBackDraft) => StepBackRecord
    listStepBacks: StepBackRepository['list']
    listBacklog: () => readonly Story[]
    listKanban: () => readonly Story[]
    editStory: (storyId: number, draft: { title: string; body: string }) => Story
    estimate: (storyId: number, points: number) => Story
    rollOut: (storyId: number, percent: number) => Story
    markMergeConflict: (storyId: number) => Story
    clearMergeConflict: (storyId: number) => Story
    blockStory: (storyId: number, reason: string) => Story
    unblockStory: (storyId: number) => Story
  }

export type StoryRepositoryOptions = {
  checkoutRoots?: readonly string[]
  now?: () => string
  onBacklog?: (story: Story) => void
}

export function createStoryRepository(
  db: Database.Database,
  { checkoutRoots = [process.cwd()], now, onBacklog }: StoryRepositoryOptions = {},
): StoryRepository {
  const epics = createEpicRepository(db, { now })
  const agenda = createEventRepository(db, { now })
  const projects = createProjectRepository(db, { epics })
  const followUps = createFollowUpRepository(db, { epics, agenda })
  const projectCatalog = createProjectCatalog(db, checkoutRoots)
  const epicCatalog = createEpicCatalog(db, { epics, projects: projectCatalog })
  const milestones = createMilestoneRepository(db)
  const stepBacks = createStepBackRepository(db)
  const statements = prepareStoryStatements(db)
  const registry = createStoryRegistry(statements, epics)
  const dependencies = createDependencyRepository(db, registry.findStory)

  return {
    ...projectCatalog,
    ...epicCatalog,
    ...milestones,
    addDependency: dependencies.addDependency,
    listBlockers: dependencies.listBlockers,
    epics,
    projects,
    agenda,
    followUps,
    findStory: registry.findStory,
    findTwin: registry.findTwin,
    listStepBacks: stepBacks.list,
    ...createStoryQueries(statements),
    ...createStoryAuthoring(statements, registry, onBacklog),
    ...createStoryFlow(statements, registry, dependencies, stepBacks),
  }
}
