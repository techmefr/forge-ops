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
    },
    perform: (step) => {
      performed.push(step)
      if (refusals.has(step.kind)) {
        throw new Error(`le pilote n a pas trouve ${step.target}`)
      }
      return answers.get(step.kind) ?? observation(`${step.kind} fait`)
    },
    inspect: () => observation('la page dit quelque chose'),
    close: () => {
      closed += 1
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
  it('opens the browser on the story url', () => {
    start()

    expect(opened).toEqual([{ url: 'http://localhost:5049/mails', pace: 'slow' }])
  })

  it('begins before the first step, nothing has been watched yet', () => {
    expect(start().position).toBe(0)
  })

  it('is running, waiting for the human to advance', () => {
    expect(start().state).toBe('running')
  })

  it('names the story it walks through', () => {
    expect(start().storyReference).toBe('FORGE-1')
  })

  it('keeps the script so the board can show what is coming', () => {
    expect(start().script).toEqual(SCRIPT)
  })

  it('refuses a second run on the same story', () => {
    start()

    expect(() => start()).toThrow(PilotRunAlreadyLiveError)
  })

  it('refuses a story that does not exist', () => {
    expect(() =>
      pilots.start({ storyId: 999, url: 'http://x.test/', pace: 'live', script: SCRIPT }),
    ).toThrow()
  })

  it('does not touch the browser when it refuses', () => {
    start()
    opened = []

    expect(() => start()).toThrow()
    expect(opened).toEqual([])
  })

  it('checks the script before opening anything', () => {
    expect(() =>
      pilots.start({ storyId, url: 'http://x.test/', pace: 'live', script: [] }),
    ).toThrow()
    expect(opened).toEqual([])
  })
})

describe('advance', () => {
  it('performs the next step of the script', () => {
    start()
    pilots.advance(storyId)

    expect(performed).toEqual([SCRIPT[0]])
  })

  it('moves the cursor forward', () => {
    start()

    expect(pilots.advance(storyId).position).toBe(1)
  })

  it('records what it saw', () => {
    start()
    answers.set('goto', { detail: 'la liste des mails', screenshotPath: '/tmp/1.png', consoleErrors: [] })

    expect(pilots.advance(storyId).acts[0]).toMatchObject({
      position: 0,
      kind: 'goto',
      outcome: 'passed',
      detail: 'la liste des mails',
      screenshotPath: '/tmp/1.png',
    })
  })

  it('passes the run once the last step is done', () => {
    start()
    pilots.advance(storyId)
    pilots.advance(storyId)

    expect(pilots.advance(storyId).state).toBe('passed')
  })

  it('closes the browser when the run is over', () => {
    start()
    pilots.advance(storyId)
    pilots.advance(storyId)
    pilots.advance(storyId)

    expect(closed).toBe(1)
  })

  it('fails the run on the step the browser refused', () => {
    start()
    refusals.add('goto')

    expect(pilots.advance(storyId).state).toBe('failed')
  })

  it('says which step failed and why', () => {
    start()
    refusals.add('goto')

    expect(pilots.advance(storyId).acts[0]).toMatchObject({
      outcome: 'failed',
      detail: expect.stringContaining('n a pas trouve'),
    })
  })

  it('stops walking after a failure', () => {
    start()
    refusals.add('goto')
    pilots.advance(storyId)

    expect(() => pilots.advance(storyId)).toThrow(PilotRunOverError)
  })

  it('fails a step whose page logged an error, a red console is not a pass', () => {
    start()
    answers.set('goto', {
      detail: 'la liste des mails',
      screenshotPath: null,
      consoleErrors: ['TypeError: undefined is not a function'],
    })

    expect(pilots.advance(storyId).acts[0]?.outcome).toBe('failed')
  })

  it('refuses to advance a paused run', () => {
    start()
    pilots.pause(storyId)

    expect(() => pilots.advance(storyId)).toThrow(PilotRunPausedError)
  })

  it('refuses to advance a story with no run', () => {
    expect(() => pilots.advance(storyId)).toThrow(PilotRunNotFoundError)
  })
})

describe('pause and resume', () => {
  it('pauses so the human can look around', () => {
    start()

    expect(pilots.pause(storyId).state).toBe('paused')
  })

  it('keeps the browser open while paused, that is the point', () => {
    start()
    pilots.pause(storyId)

    expect(closed).toBe(0)
  })

  it('resumes where it stopped', () => {
    start()
    pilots.advance(storyId)
    pilots.pause(storyId)

    expect(pilots.resume(storyId).position).toBe(1)
  })

  it('walks again once resumed', () => {
    start()
    pilots.pause(storyId)
    pilots.resume(storyId)

    expect(() => pilots.advance(storyId)).not.toThrow()
  })

  it('refuses to pause a run that is already over', () => {
    start()
    refusals.add('goto')
    pilots.advance(storyId)

    expect(() => pilots.pause(storyId)).toThrow(PilotRunOverError)
  })
})

describe('inspect', () => {
  it('reads the page without moving the cursor', () => {
    start()
    pilots.pause(storyId)

    expect(pilots.inspect(storyId).detail).toBe('la page dit quelque chose')
    expect(pilots.findForStory(storyId)?.position).toBe(0)
  })

  it('refuses to inspect a story with no run', () => {
    expect(() => pilots.inspect(storyId)).toThrow(PilotRunNotFoundError)
  })
})

describe('abandon', () => {
  it('closes the browser and gives up', () => {
    start()
    pilots.abandon(storyId)

    expect(closed).toBe(1)
  })

  it('leaves no live run behind', () => {
    start()
    pilots.abandon(storyId)

    expect(pilots.findForStory(storyId)).toBeNull()
  })

  it('lets a new run start afterwards', () => {
    start()
    pilots.abandon(storyId)

    expect(() => start()).not.toThrow()
  })

  it('refuses to abandon a story with no run', () => {
    expect(() => pilots.abandon(storyId)).toThrow(PilotRunNotFoundError)
  })
})

describe('findForStory', () => {
  it('rends nothing before any run', () => {
    expect(pilots.findForStory(storyId)).toBeNull()
  })

  it('rends nothing once the run has passed', () => {
    start()
    pilots.advance(storyId)
    pilots.advance(storyId)
    pilots.advance(storyId)

    expect(pilots.findForStory(storyId)).toBeNull()
  })
})

describe('history', () => {
  it('is empty on a fresh board', () => {
    expect(pilots.history(storyId)).toEqual([])
  })

  it('keeps a finished run, the evidence outlives the browser', () => {
    start()
    pilots.abandon(storyId)

    expect(pilots.history(storyId)).toHaveLength(1)
  })

  it('keeps the acts of a finished run', () => {
    start()
    pilots.advance(storyId)
    pilots.abandon(storyId)

    expect(pilots.history(storyId)[0]?.acts).toHaveLength(1)
  })

  it('shows the most recent run first', () => {
    start()
    pilots.abandon(storyId)
    start()
    pilots.abandon(storyId)

    const runs = pilots.history(storyId)

    expect(runs[0]?.id).toBeGreaterThan(runs[1]?.id ?? 0)
  })
})
