import type { DemoContext } from './DemoContext.js'
import { REVIEW_LENS_SEQUENCE } from '../domain/Checkpoint/Checkpoint.js'
import type { CheckpointName } from '../domain/Checkpoint/Checkpoint.js'
import type { AgentPhase } from '../domain/Agent/AgentSession.js'
import { LENS_AGENTS, LENS_COST, LENS_SECONDS, LENS_TOKENS, PLAN, PROVEN_UP_TO, SESSION_PLAN, TOUCH_PLAN } from './DemoPlans.js'

function evidenceOf(reference: string, name: CheckpointName): string {
  return `.claude/evidence/${reference.toLowerCase()}/${name}.md`
}

export function seedSessions(context: DemoContext): void {
  const { sessions, backdateSession, storyIds } = context
  const sessionOf = new Map<string, string>()
  SESSION_PLAN.forEach((plan, index) => {
    const storyId = storyIds.get(plan.story)
    if (storyId === undefined) {
      return
    }
    const claudeSessionId = `${plan.story.replace('/', '-')}-${plan.phase}-${index}`
    const key = `${plan.story}/${plan.phase}`
    if (!sessionOf.has(key)) {
      sessionOf.set(key, claudeSessionId)
    }
    sessions.registerSession({
      storyId,
      claudeSessionId,
      phase: plan.phase,
      agentName: plan.agentName,
      claudeCodeVersion: '2.1.224',
    })
    sessions.recordUsage(claudeSessionId, {
      costUsd: plan.costUsd,
      inputTokens: plan.inputTokens,
      outputTokens: plan.outputTokens,
    })
    if (plan.exit === null) {
      sessions.updateLifecycle(claudeSessionId, 'working')
    } else {
      sessions.closeSession(claudeSessionId, plan.exit)
    }
    backdateSession.run(-plan.daysAgo, -plan.seconds, -plan.daysAgo, claudeSessionId)
  })

  function workerOn(story: string): string | undefined {
    const phases: readonly AgentPhase[] = ['code', 'tdd', 'architecture', 'gate', 'review', 'spec', 'ship']
    for (const phase of phases) {
      const found = sessionOf.get(`${story}/${phase}`)
      if (found !== undefined) {
        return found
      }
    }
    return undefined
  }

  for (const plan of TOUCH_PLAN) {
    const claudeSessionId = workerOn(plan.story)
    if (claudeSessionId === undefined) {
      continue
    }
    for (const path of plan.paths) {
      sessions.recordFileTouch({ claudeSessionId, path })
    }
  }
}

export function proveCheckpoints(context: DemoContext): void {
  const { checkpoints, sessions, backdateSession, storyIds, references } = context
  for (const project of PLAN) {
    for (const plan of project.stories) {
      const key = `${project.slug}/${plan.slug}`
      const storyId = storyIds.get(key)
      const reference = references.get(key)
      if (storyId === undefined || reference === undefined || plan.proven === null) {
        continue
      }
      const wanted = PROVEN_UP_TO.slice(0, PROVEN_UP_TO.indexOf(plan.proven) + 1)
      const needsCascade = wanted.includes('reviewed')
      if (needsCascade) {
        for (const lens of REVIEW_LENS_SEQUENCE) {
          const claudeSessionId = `${key.replace('/', '-')}-lens-${lens}`
          sessions.registerSession({
            storyId,
            claudeSessionId,
            phase: 'review',
            agentName: LENS_AGENTS[lens],
            claudeCodeVersion: '2.1.224',
          })
          sessions.recordUsage(claudeSessionId, {
            costUsd: LENS_COST[lens],
            inputTokens: LENS_TOKENS[lens],
            outputTokens: Math.round(LENS_TOKENS[lens] / 8),
          })
          sessions.closeSession(claudeSessionId, { exitCode: 0 })
          backdateSession.run(-2, -LENS_SECONDS[lens], -2, claudeSessionId)
          checkpoints.startLens(storyId, lens, claudeSessionId)
          checkpoints.passLens(storyId, lens)
        }
      }
      for (const name of wanted) {
        checkpoints.proveCheckpoint({ storyId, name, evidencePath: evidenceOf(reference, name) })
      }
    }
  }
}

export function seedScopeReview(context: DemoContext): void {
  const { checkpoints, sessions, foremerge, backdateSession, storyIds } = context
  const scopeStory = storyIds.get('forge/scope')
  if (scopeStory !== undefined) {
    const lensSessionOf = (lens: 'quality' | 'security'): string => {
      const claudeSessionId = `forge-scope-lens-${lens}`
      sessions.registerSession({
        storyId: scopeStory,
        claudeSessionId,
        phase: 'review',
        agentName: LENS_AGENTS[lens],
        claudeCodeVersion: '2.1.224',
      })
      sessions.recordUsage(claudeSessionId, {
        costUsd: LENS_COST[lens],
        inputTokens: LENS_TOKENS[lens],
        outputTokens: Math.round(LENS_TOKENS[lens] / 8),
      })
      return claudeSessionId
    }
    const qualitySession = lensSessionOf('quality')
    const securitySession = lensSessionOf('security')
    sessions.closeSession(qualitySession, { exitCode: 0 })
    backdateSession.run(-1, -LENS_SECONDS.quality, -1, qualitySession)
    backdateSession.run(-1, -LENS_SECONDS.security, -1, securitySession)
    checkpoints.startLens(scopeStory, 'quality', qualitySession)
    checkpoints.passLens(scopeStory, 'quality')
    checkpoints.startLens(scopeStory, 'security', securitySession)
    checkpoints.recordFinding({
      storyId: scopeStory,
      claudeSessionId: securitySession,
      lens: 'security',
      severity: 'weak',
      path: 'backend/src/domain/Foremerge/ScopeGuard.ts',
      line: 42,
      statement: 'an absolute path arrives as is, it would be better to bring it back to the root before comparing',
    })
    foremerge.reserve({
      storyId: scopeStory,
      pathPrefix: 'backend/src/domain/Foremerge',
      symbols: ['decideOnWrite', 'ScopeReservation'],
    })
  }
}

export function seedStoryScenarios(context: DemoContext): void {
  const { stories, foremerge, insertWorktree, insertPort, insertRun, insertAct, storyIds } = context
  const digestStory = storyIds.get('forge/digest')
  const pilotStory = storyIds.get('forge/pilot')
  const metricsStory = storyIds.get('forge/metrics')
  const writeStory = storyIds.get('mailer/write')
  if (digestStory !== undefined) {
    foremerge.reserve({
      storyId: digestStory,
      pathPrefix: 'backend/src/domain/Zone',
      symbols: ['describeZone', 'ZoneOverview'],
    })
    stories.markMergeConflict(digestStory)
  }

  if (pilotStory !== undefined) {
    foremerge.reserve({
      storyId: pilotStory,
      pathPrefix: 'backend/src/domain/Pilot',
      symbols: ['PilotRun', 'suggestParcours'],
    })
    const worktree = insertWorktree.run(
      pilotStory,
      '/tmp/forge-worktrees/forge-3',
      'story/forge-3-piloter-le-navigateur',
      'forge',
      '9c1d4f2a7b3e5d6c8f0a1b2c3d4e5f60718293a4',
    )
    insertPort.run(4103, Number(worktree.lastInsertRowid), 'forge-3')
    const run = insertRun.run(
      pilotStory,
      'http://localhost:4103/',
      'slow',
      'passed',
      JSON.stringify([
        { kind: 'goto', target: 'http://localhost:4103/' },
        { kind: 'screenshot' },
        { kind: 'click', target: 'text=Avancer' },
        { kind: 'screenshot' },
      ]),
      4,
    )
    const runId = Number(run.lastInsertRowid)
    insertAct.run(runId, 1, 'goto', 'http://localhost:4103/', 'passed', 'the page answered in 240 ms', 'pilot-1-1.png')
    insertAct.run(runId, 2, 'screenshot', null, 'passed', 'capture of the view on load', 'pilot-1-2.png')
    insertAct.run(runId, 3, 'click', 'text=Avancer', 'passed', 'the button moved the journey forward', 'pilot-1-3.png')
    insertAct.run(runId, 4, 'screenshot', null, 'passed', 'capture after the click', 'pilot-1-4.png')
  }

  if (metricsStory !== undefined) {
    const worktree = insertWorktree.run(
      metricsStory,
      '/tmp/forge-worktrees/forge-5',
      'story/forge-5-metriques-machine',
      'forge',
      '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
    )
    insertPort.run(4105, Number(worktree.lastInsertRowid), 'forge-5')
  }

  if (writeStory !== undefined) {
    const worktree = insertWorktree.run(
      writeStory,
      '/tmp/forge-worktrees/mailer-2',
      'story/mailer-2-creer-modifier-un-mail',
      'main',
      'f0e1d2c3b4a5968778695a4b3c2d1e0f10203040',
    )
    insertPort.run(4202, Number(worktree.lastInsertRowid), 'mailer-2')
  }
}

export function escalateOrphan(context: DemoContext): void {
  const { setState, setEscalation, storyIds } = context
  const orphanStory = storyIds.get('forge/orphan')
  if (orphanStory !== undefined) {
    setState.run('escalated', 'escalated', orphanStory)
    setEscalation.run(
      "the session repeated the same build error twice, the board stopped it and waits for a decision",
      orphanStory,
    )
  }
}

export function placeStories(context: DemoContext): void {
  const { stories, setState, placeInColumn, storyIds } = context
  for (const project of PLAN) {
    for (const plan of project.stories) {
      const storyId = storyIds.get(`${project.slug}/${plan.slug}`)
      if (storyId === undefined || plan.state === 'drafting' || plan.state === 'backlog') {
        continue
      }
      if (plan.state === 'flagged') {
        stories.rollOut(storyId, 25)
        continue
      }
      setState.run(plan.state, plan.state, storyId)
      if (plan.column !== undefined) {
        placeInColumn.run(plan.column, storyId)
      }
    }
  }
}
