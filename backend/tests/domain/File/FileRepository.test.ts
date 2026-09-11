import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createFileRepository, type FileRepository } from '../../../src/domain/File/FileRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { openDatabase } from '../../../src/technical/Database/Connection.js'

let db: Database.Database
let files: FileRepository
let projectId: number
let otherProjectId: number

function bearing(slug: string, path: string, agentName: string, sessionId: string): number {
  const stories = createStoryRepository(db)
  const sessions = createAgentSessionRepository(db)
  const project = stories.createProject({
    slug,
    name: slug,
    repositoryUrl: `git@example.com:${slug}.git`,
    integrationBranch: 'main',
    colour: '#8B5CFF',
  })
  const epic = stories.createEpic({ projectId: project.id, title: slug, businessIntent: 'besoin' })
  const story = stories.writeStory({ epicId: epic.id, title: 'porter le fichier', body: 'corps' })
  sessions.registerSession({ storyId: story.id, claudeSessionId: sessionId, phase: 'code', agentName, claudeCodeVersion: '2.1.224' })
  sessions.recordFileTouch({ claudeSessionId: sessionId, path })
  return project.id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  files = createFileRepository(db)
  projectId = bearing('forge', 'frontend/src/domain/User/UserModal.vue', 'neo', 'session-1')
  otherProjectId = bearing('mailer', 'backend/src/domain/Mail/MailApi.ts', 'trinity', 'session-2')
})

describe('touchesOfProject', () => {
  it('rend les touches du projet, par chemin', () => {
    const touches = files.touchesOfProject(projectId)
    expect([...touches.keys()]).toEqual(['frontend/src/domain/User/UserModal.vue'])
    expect(touches.get('frontend/src/domain/User/UserModal.vue')).toEqual([
      { storyReference: 'FORGE-1', storyState: 'drafting', agentName: 'neo' },
    ])
  })

  it('ne melange pas les projets', () => {
    expect([...files.touchesOfProject(otherProjectId).keys()]).toEqual([
      'backend/src/domain/Mail/MailApi.ts',
    ])
  })

  it('rend une carte vide pour un projet sans travail', () => {
    expect(files.touchesOfProject(9999).size).toBe(0)
  })
})
