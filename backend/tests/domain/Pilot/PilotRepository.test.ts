import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createStoryRepository,
  type StoryRepository,
} from '../../../src/domain/Story/StoryRepository.js'
import {
  createPilotRepository,
  type PilotRepository,
} from '../../../src/domain/Pilot/PilotRepository.js'
import type { PilotDriver, PilotObservation, PilotStep } from '../../../src/domain/Pilot/Pilot.js'
import {
  PilotRunAlreadyLiveError,
  PilotRunNotFoundError,
  PilotRunOverError,
  PilotRunPausedError,
  UnsafeDestinationError,
} from '../../../src/domain/Pilot/PilotViolation.js'

type Opened = { url: string; pace: string }

let db: Database.Database
let stories: StoryRepository
let pilots: PilotRepository
let storyId: number
let opened: Opened[]
let performed: PilotStep[]
let closed: number
let answers: Map<string, PilotObservation>
let refusals: Set<string>

const SCRIPT: readonly PilotStep[] = [
  { kind: 'goto', target: 'http://localhost:5049/mails' },
  { kind: 'click', target: '[data-test-id=compose]' },
  { kind: 'expectText', target: 'main', value: 'Nouveau mail' },
]

function observation(detail: string): PilotObservation {
  return { detail, screenshotPath: null, consoleErrors: [] }
}

function fakeDriver(): PilotDriver {
  return {
    open: (url, pace) => {
      opened.push({ url, pace })
      return Promise.resolve()
    },
    perform: (step) => {
      performed.push(step)
      if (refusals.has(step.kind)) {
        return Promise.reject(new Error(`le pilote n a pas trouve ${step.target}`))
      }
      return Promise.resolve(answers.get(step.kind) ?? observation(`${step.kind} fait`))
    },
    inspect: () => Promise.resolve(observation('la page dit quelque chose')),
    close: () => {
      closed += 1
      return Promise.resolve()
    },
  }
}

function start(): ReturnType<PilotRepository['start']> {
  return pilots.start({ storyId, url: 'http://localhost:5049/mails', pace: 'slow', script: SCRIPT })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  opened = []
  performed = []
  closed = 0
  answers = new Map()
  refusals = new Set()
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que' }).id
  pilots = createPilotRepository(db, { stories, driver: fakeDriver() })
})

describe('start', () => {
  it('opens the browser on the story url', async () => {
    await start()

    expect(opened).toEqual([{ url: 'http://localhost:5049/mails', pace: 'slow' }])
  })

  it('begins before the first step, nothing has been watched yet', async () => {
    expect((await start()).position).toBe(0)
  })

  it('is running, waiting for the human to advance', async () => {
    expect((await start()).state).toBe('running')
  })

  it('names the story it walks through', async () => {
    expect((await start()).storyReference).toBe('FORGE-1')
  })

  it('keeps the script so the board can show what is coming', async () => {
    expect((await start()).script).toEqual(SCRIPT)
  })

  it('refuses a second run on the same story', async () => {
    await start()

    await expect(start()).rejects.toThrow(PilotRunAlreadyLiveError)
  })

  it('refuses a story that does not exist', async () => {
    await expect(
      pilots.start({ storyId: 999, url: 'http://x.test/', pace: 'live', script: SCRIPT }),
    ).rejects.toThrow()
  })

  it('does not touch the browser when it refuses', async () => {
    await start()
    opened = []

    await expect(start()).rejects.toThrow()
    expect(opened).toEqual([])
  })

  it('refuses a destination that is not a web address, a pilot is not a file reader', async () => {
    await expect(
      pilots.start({ storyId, url: 'file:///etc/passwd', pace: 'live', script: SCRIPT }),
    ).rejects.toThrow(UnsafeDestinationError)
    expect(opened).toEqual([])
  })

  it('checks the script before opening anything', async () => {
    await expect(
      pilots.start({ storyId, url: 'http://x.test/', pace: 'live', script: [] }),
    ).rejects.toThrow()
    expect(opened).toEqual([])
  })
})

describe('advance', () => {
  it('performs the next step of the script', async () => {
    await start()
    await pilots.advance(storyId)

    expect(performed).toEqual([SCRIPT[0]])
  })

  it('moves the cursor forward', async () => {
    await start()

    expect((await pilots.advance(storyId)).position).toBe(1)
  })

  it('records what it saw', async () => {
    await start()
    answers.set('goto', { detail: 'la liste des mails', screenshotPath: '/tmp/1.png', consoleErrors: [] })

    expect((await pilots.advance(storyId)).acts[0]).toMatchObject({
      position: 0,
      kind: 'goto',
      outcome: 'passed',
      detail: 'la liste des mails',
      screenshotPath: '/tmp/1.png',
    })
  })

  it('passes the run once the last step is done', async () => {
    await start()
    await pilots.advance(storyId)
    await pilots.advance(storyId)

    expect((await pilots.advance(storyId)).state).toBe('passed')
  })

  it('closes the browser when the run is over', async () => {
    await start()
    await pilots.advance(storyId)
    await pilots.advance(storyId)
    await pilots.advance(storyId)

    expect(closed).toBe(1)
  })

  it('fails the run on the step the browser refused', async () => {
    await start()
    refusals.add('goto')

    expect((await pilots.advance(storyId)).state).toBe('failed')
  })

  it('says which step failed and why', async () => {
    await start()
    refusals.add('goto')

    expect((await pilots.advance(storyId)).acts[0]).toMatchObject({
      outcome: 'failed',
      detail: expect.stringContaining('n a pas trouve'),
    })
  })

  it('stops walking after a failure', async () => {
    await start()
    refusals.add('goto')
    await pilots.advance(storyId)

    await expect(pilots.advance(storyId)).rejects.toThrow(PilotRunOverError)
  })

  it('fails a step whose page logged an error, a red console is not a pass', async () => {
    await start()
    answers.set('goto', {
      detail: 'la liste des mails',
      screenshotPath: null,
      consoleErrors: ['TypeError: undefined is not a function'],
    })

    expect((await pilots.advance(storyId)).acts[0]?.outcome).toBe('failed')
  })

  it('refuses to advance a paused run', async () => {
    await start()
    pilots.pause(storyId)

    await expect(pilots.advance(storyId)).rejects.toThrow(PilotRunPausedError)
  })

  it('refuses to advance a story with no run', async () => {
    await expect(pilots.advance(storyId)).rejects.toThrow(PilotRunNotFoundError)
  })
})

describe('pause and resume', () => {
  it('pauses so the human can look around', async () => {
    await start()

    expect(pilots.pause(storyId).state).toBe('paused')
  })

  it('keeps the browser open while paused, that is the point', async () => {
    await start()
    pilots.pause(storyId)

    expect(closed).toBe(0)
  })

  it('resumes where it stopped', async () => {
    await start()
    await pilots.advance(storyId)
    pilots.pause(storyId)

    expect(pilots.resume(storyId).position).toBe(1)
  })

  it('walks again once resumed', async () => {
    await start()
    pilots.pause(storyId)
    pilots.resume(storyId)

    await expect(pilots.advance(storyId)).resolves.toBeDefined()
  })

  it('refuses to pause a run that is already over', async () => {
    await start()
    refusals.add('goto')
    await pilots.advance(storyId)

    expect(() => pilots.pause(storyId)).toThrow(PilotRunOverError)
  })
})

describe('inspect', () => {
  it('reads the page without moving the cursor', async () => {
    await start()
    pilots.pause(storyId)

    expect((await pilots.inspect(storyId)).detail).toBe('la page dit quelque chose')
    expect(pilots.findForStory(storyId)?.position).toBe(0)
  })

  it('refuses to inspect a story with no run', async () => {
    await expect(pilots.inspect(storyId)).rejects.toThrow(PilotRunNotFoundError)
  })
})

describe('abandon', () => {
  it('closes the browser and gives up', async () => {
    await start()
    await pilots.abandon(storyId)

    expect(closed).toBe(1)
  })

  it('leaves no live run behind', async () => {
    await start()
    await pilots.abandon(storyId)

    expect(pilots.findForStory(storyId)).toBeNull()
  })

  it('lets a new run start afterwards', async () => {
    await start()
    await pilots.abandon(storyId)

    await expect(start()).resolves.toBeDefined()
  })

  it('refuses to abandon a story with no run', async () => {
    await expect(pilots.abandon(storyId)).rejects.toThrow(PilotRunNotFoundError)
  })
})

describe('findForStory', () => {
  it('rends nothing before any run', async () => {
    expect(pilots.findForStory(storyId)).toBeNull()
  })

  it('rends nothing once the run has passed', async () => {
    await start()
    await pilots.advance(storyId)
    await pilots.advance(storyId)
    await pilots.advance(storyId)

    expect(pilots.findForStory(storyId)).toBeNull()
  })
})

describe('history', () => {
  it('is empty on a fresh board', async () => {
    expect(pilots.history(storyId)).toEqual([])
  })

  it('keeps a finished run, the evidence outlives the browser', async () => {
    await start()
    await pilots.abandon(storyId)

    expect(pilots.history(storyId)).toHaveLength(1)
  })

  it('keeps the acts of a finished run', async () => {
    await start()
    await pilots.advance(storyId)
    await pilots.abandon(storyId)

    expect(pilots.history(storyId)[0]?.acts).toHaveLength(1)
  })

  it('shows the most recent run first', async () => {
    await start()
    await pilots.abandon(storyId)
    await start()
    await pilots.abandon(storyId)

    const runs = pilots.history(storyId)

    expect(runs[0]?.id).toBeGreaterThan(runs[1]?.id ?? 0)
  })
})
