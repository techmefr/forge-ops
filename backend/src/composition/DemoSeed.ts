import type { EpicPatch } from '../../../contract/EpicContract.js'
import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { createIncidentRepository } from '../domain/Incident/IncidentRepository.js'
import { createIdentityRepository } from '../domain/Identity/IdentityRepository.js'
import { createStoryRepository } from '../domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../domain/Checkpoint/CheckpointRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../domain/Checkpoint/PermissiveCheckpointGate.js'
import { createCriterionRepository } from '../domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createZoneRepository } from '../domain/Zone/ZoneRepository.js'
import { createForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createDiscussionRepository } from '../domain/Discussion/DiscussionRepository.js'
import { createBudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { describeZone } from '../domain/Zone/ZoneDigest.js'
import { REVIEW_LENS_SEQUENCE } from '../domain/Checkpoint/Checkpoint.js'
import type { CheckpointName } from '../domain/Checkpoint/Checkpoint.js'
import type { StoryState } from '../domain/Story/Story.js'
import type { AgentPhase } from '../domain/Agent/AgentSession.js'
import { createProjectWorkflowRepository, STORY_WORKFLOW_ID_SQL } from '../domain/Workflow/ProjectWorkflowRepository.js'
import { createWorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'

import {
  CENSUS,
  DEMO_STEPS,
  HOTFIX_STEPS,
  LENS_AGENTS,
  LENS_COST,
  LENS_SECONDS,
  LENS_TOKENS,
  MARKER,
  PLAN,
  PROJECT_EXTRAS,
  PROVEN_UP_TO,
  REMARK_PLAN,
  SESSION_PLAN,
  SPARE_EPICS,
  TAG_PLAN,
  TOUCH_PLAN,
  USER_PLAN,
  ZONE_PLAN,
  dayFromNow,
  milestonesOf,

} from './DemoPlans.js'

export type DemoBoard = {
  projects: number
  stories: number
  sessions: number
  zones: number
}

export function reviveDemoSessions(db: Database.Database): number {
  const revive = db.prepare<[string]>(
    `UPDATE agent_session
        SET lifecycle = 'working', outcome = NULL, ended_at = NULL, last_heartbeat_at = datetime('now')
      WHERE claude_session_id = ?`,
  )
  let revived = 0
  SESSION_PLAN.forEach((plan, index) => {
    if (plan.exit === null) {
      revived += revive.run(`${plan.story.replace('/', '-')}-${plan.phase}-${index}`).changes
    }
  })
  return revived
}

function evidenceOf(reference: string, name: CheckpointName): string {
  return `.claude/evidence/${reference.toLowerCase()}/${name}.md`
}

export function seedDemoBoard(db: Database.Database): DemoBoard {
  const marker = db
    .prepare<[string], { value: string }>('SELECT value FROM board_setting WHERE key = ?')
    .get(MARKER)
  const stories = createStoryRepository(db)
  const zones = createZoneRepository(db)
  if (marker !== undefined) {
    return {
      projects: stories.listProjects().length,
      stories: stories.listKanban().length,
      sessions: SESSION_PLAN.length,
      zones: ZONE_PLAN.length,
    }
  }

  const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => CENSUS,
  })
  const criteria = createCriterionRepository(db)
  const sessions = createAgentSessionRepository(db)
  const foremerge = createForemergeRepository(db, { stories })
  const budget = createBudgetRepository(db)
  const discussion = createDiscussionRepository(db, { stories })
  const identities = createIdentityRepository(db)

  identities.bootstrapSuperAdmin({ login: 'local', password: randomBytes(24).toString('hex') })
  identities.changeCapacity('local', 5)
  identities.changeDisplayName('local', 'Demo architect')
  for (const user of USER_PLAN) {
    identities.enrolUser({
      login: user.login,
      displayName: user.displayName,
      password: randomBytes(24).toString('hex'),
      role: user.role,
    })
    if (user.capacity !== null) {
      identities.changeCapacity(user.login, user.capacity)
    }
    if (!user.active) {
      identities.changeActive(user.login, false)
    }
  }
  const tagIds = new Map<string, number>()
  for (const tag of TAG_PLAN) {
    tagIds.set(tag.label, stories.epics.createTag(tag).id)
  }

  const setState = db.prepare<[StoryState, StoryState, number]>(
    `UPDATE story
        SET state = ?,
            workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                WHERE workflow_column.workflow_id = ${STORY_WORKFLOW_ID_SQL} AND workflow_column.key = ?
            )
      WHERE id = ?`,
  )
  const workflowColumns = createWorkflowColumnRepository(db)
  const placeInColumn = db.prepare<[string, number]>(
    `UPDATE story
        SET workflow_column_id = (
              SELECT workflow_column.id FROM workflow_column
                WHERE workflow_column.workflow_id = ${STORY_WORKFLOW_ID_SQL} AND workflow_column.key = ?
            )
      WHERE id = ?`,
  )
  const setEscalation = db.prepare<[string, number]>('UPDATE story SET escalation_reason = ? WHERE id = ?')
  const backdateSession = db.prepare<[number, number, number, string]>(
    `UPDATE agent_session
        SET started_at = datetime('now', CASE WHEN ended_at IS NULL THEN '0' ELSE ? END || ' days', ? || ' seconds'),
            ended_at = CASE WHEN ended_at IS NULL THEN NULL ELSE datetime('now', ? || ' days') END
      WHERE claude_session_id = ?`,
  )
  const insertWorktree = db.prepare<[number, string, string, string, string]>(
    'INSERT INTO worktree (story_id, path, branch, base_ref, base_sha) VALUES (?, ?, ?, ?, ?)',
  )
  const insertPort = db.prepare<[number, number, string]>(
    'INSERT INTO port_reservation (port, worktree_id, subdomain) VALUES (?, ?, ?)',
  )
  const insertRun = db.prepare<[number, string, string, string, string, number]>(
    `INSERT INTO pilot_run (story_id, url, pace, state, script, position, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`,
  )
  const insertAct = db.prepare<[number, number, string, string | null, string, string, string | null]>(
    `INSERT INTO pilot_act (pilot_run_id, position, kind, target, outcome, detail, screenshot_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const markSeeded = db.prepare<[string, string]>(
    'INSERT INTO board_setting (key, value) VALUES (?, ?)',
  )

  const storyIds = new Map<string, number>()
  const references = new Map<string, string>()
  const projectIds = new Map<string, number>()

  for (const project of PLAN) {
    const written = stories.createProject({
      slug: project.slug,
      name: project.name,
      repositoryUrl: `git@github.com:techmefr/${project.slug === 'forge' ? 'forge-ops' : project.slug}.git`,
      integrationBranch: 'main',
      colour: project.colour,
      checkoutPath: project.slug === 'forge' ? process.cwd() : null,
    })
    projectIds.set(project.slug, written.id)
    for (const step of project.steps ?? DEMO_STEPS) {
      workflowColumns.create(written.id, step)
    }
    const epic = stories.createEpic({
      projectId: written.id,
      title: project.epicTitle,
      businessIntent: project.epicIntent,
    })
    stories.claimEpic(epic.id, 'local')
    for (const milestone of milestonesOf(epic.id, projectIds.size)) {
      stories.writeMilestone(milestone)
    }

    for (const plan of project.stories) {
      const story = stories.writeStory({ epicId: epic.id, title: plan.title, body: plan.body })
      stories.writeTwin({
        storyId: story.id,
        title: plan.twinTitle,
        body: `Acceptance cases of ${story.reference}, written before the code.`,
      })
      const key = `${project.slug}/${plan.slug}`
      storyIds.set(key, story.id)
      references.set(key, story.reference)

      let index = 0
      for (const criterion of plan.criteria) {
        index += 1
        const declared = criteria.declareCriterion({
          storyId: story.id,
          reference: `${story.reference}-C${index}`,
          statement: criterion.statement,
        })
        if (criterion.met) {
          criteria.satisfyCriterion(declared.id, `.claude/evidence/${story.reference.toLowerCase()}/c${index}.png`)
        }
      }

      if (plan.points !== null) {
        stories.estimate(story.id, plan.points)
      }
      if (plan.state !== 'drafting') {
        stories.sendToBacklog(story.id)
      }
    }
  }


  const epicIds = new Map<string, number>()
  for (const spare of SPARE_EPICS) {
    const projectId = projectIds.get(spare.project)
    if (projectId === undefined) {
      continue
    }
    const epic = stories.createEpic({
      projectId,
      title: spare.title,
      businessIntent: spare.intent,
    })
    if (spare.assignee !== null) {
      stories.claimEpic(epic.id, spare.assignee)
    }
    if (spare.planning !== undefined) {
      stories.epics.plan(epic.id, spare.planning)
    }
    if (spare.lateByDays !== undefined) {
      stories.writeMilestone({ epicId: epic.id, kind: 'demo', dueOn: dayFromNow(-spare.lateByDays) })
    }
    epicIds.set(spare.title, epic.id)
  }
  for (const spare of SPARE_EPICS) {
    const epicId = epicIds.get(spare.title)
    if (epicId === undefined) {
      continue
    }
    const patch: EpicPatch = {
      ...(spare.tags === undefined
        ? {}
        : { tagIds: spare.tags.flatMap((label) => tagIds.get(label) ?? []) }),
      ...(spare.dependsOn === undefined
        ? {}
        : { dependsOn: spare.dependsOn.flatMap((title) => epicIds.get(title) ?? []) }),
      ...(spare.links === undefined ? {} : { links: [...spare.links] }),
    }
    if (Object.keys(patch).length > 0) {
      stories.epics.plan(epicId, patch)
    }
    if (spare.deleted === true) {
      stories.epics.softDelete(epicId, 'local')
    }
  }
  for (const projectId of projectIds.values()) {
    const first = stories.listEpics(projectId)[0]
    if (first === undefined) {
      continue
    }
    stories.epics.plan(first.id, { startedOn: dayFromNow(-24) })
    const slug = [...projectIds.entries()].find(([, id]) => id === projectId)?.[0] ?? ''
    const extras = PROJECT_EXTRAS[slug]
    if (extras !== undefined) {
      const admin = extras.admin === null ? null : identities.findUser(extras.admin)
      if (admin !== null) {
        stories.projects.update(projectId, { adminId: admin.id })
      }
      if (extras.links.length > 0) {
        stories.epics.setProjectLinks(projectId, extras.links)
      }
      for (const event of extras.events) {
        stories.agenda.create({
          type: event.type,
          date: dayFromNow(event.inDays),
          title: event.title,
          projectId,
          epicId: event.onFirstEpic ? first.id : null,
          note: null,
          minutes: event.minutes,
        })
      }
      for (const risk of extras.risks) {
        stories.followUps.openRisk(
          projectId,
          { text: risk.text, level: risk.level, owner: risk.owner, epicId: null },
          dayFromNow(-risk.openedDaysAgo),
        )
      }
      for (const decision of extras.decisions) {
        stories.followUps.recordDecision(
          projectId,
          { text: decision.text, decidedOn: dayFromNow(-decision.daysAgo), decidedBy: decision.by },
          'local',
          dayFromNow(0),
        )
      }
      stories.followUps.changeWeather(projectId, { statusSentence: extras.sentence })
      if (extras.calm) {
        continue
      }
    }
    const agenda = [
      { type: 'steering', inDays: -14, title: 'Steering committee', epicId: null, minutes: 'Priority stays on the first epic. Next review in three weeks.' },
      { type: 'client', inDays: -3, title: 'Client review', epicId: first.id, minutes: null },
      { type: 'production', inDays: 9, title: 'Production release', epicId: first.id, minutes: null },
      { type: 'steering', inDays: 16, title: 'Steering committee', epicId: null, minutes: null },
    ] as const
    for (const event of agenda) {
      stories.agenda.create({
        type: event.type,
        date: dayFromNow(event.inDays),
        title: event.title,
        projectId,
        epicId: event.epicId,
        note: null,
        minutes: event.minutes,
      })
    }
    stories.followUps.openRisk(
      projectId,
      { text: 'The client validation may slip past the release date', level: 'high', owner: null, epicId: first.id },
      dayFromNow(-5),
    )
    stories.followUps.openRisk(
      projectId,
      { text: 'Staging data is not refreshed every week', level: 'low', owner: null, epicId: null },
      dayFromNow(-9),
    )
    stories.followUps.recordDecision(
      projectId,
      { text: 'Release stays on the planned date, scope is frozen', decidedOn: dayFromNow(-14), decidedBy: 'Steering committee' },
      'local',
      dayFromNow(0),
    )
  }
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

  const projects = stories.listProjects()
  for (const zone of ZONE_PLAN) {
    const owner = projects.find((candidate) => candidate.slug === zone.project)
    if (owner === undefined) {
      continue
    }
    zones.declareZone({
      projectId: owner.id,
      pathPrefix: zone.pathPrefix,
      name: zone.name,
      colour: zone.colour,
    })
    zones.summariseZone(
      owner.id,
      zone.pathPrefix,
      describeZone(zones.overviewOfZone(owner.id, zone.pathPrefix)),
    )
  }

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

  const scopeStory = storyIds.get('forge/scope')
  const pilotStory = storyIds.get('forge/pilot')
  const digestStory = storyIds.get('forge/digest')
  const metricsStory = storyIds.get('forge/metrics')
  const orphanStory = storyIds.get('forge/orphan')
  const writeStory = storyIds.get('mailer/write')
  const deleteStory = storyIds.get('mailer/delete')
  const atlasStory = storyIds.get('atlas/zones')

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

  if (orphanStory !== undefined) {
    setState.run('escalated', 'escalated', orphanStory)
    setEscalation.run(
      "the session repeated the same build error twice, the board stopped it and waits for a decision",
      orphanStory,
    )
  }

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

  const forgeProjectId = projectIds.get('forge')
  if (forgeProjectId !== undefined) {
    const hotfix = createProjectWorkflowRepository(db).create(forgeProjectId, 'Hotfix')
    for (const step of HOTFIX_STEPS) {
      workflowColumns.create(forgeProjectId, step, hotfix.id)
    }
    const epicId = db.prepare<[number], { id: number }>('SELECT id FROM epic WHERE project_id = ? ORDER BY id LIMIT 1').get(forgeProjectId)?.id
    if (epicId !== undefined) {
      const fix = stories.writeStory({
        epicId,
        title: 'fix the scope release after a rename',
        body: 'As an architect I want a renamed path to free its reservation so the next story is not blocked by a ghost.',
      })
      stories.writeTwin({
        storyId: fix.id,
        title: 'prove the scope release after a rename',
        body: `Acceptance cases of ${fix.reference}, written before the code.`,
      })
      stories.sendToBacklog(fix.id)
      db.prepare<[number, number, number]>(
        `UPDATE story
            SET workflow_id = ?, state = 'building',
                workflow_column_id = (SELECT id FROM workflow_column WHERE workflow_id = ? AND key = 'build')
          WHERE id = ?`,
      ).run(hotfix.id, hotfix.id, fix.id)
    }
  }

  if (writeStory !== undefined && deleteStory !== undefined) {
    stories.addDependency({ blockedStoryId: writeStory, blockingStoryId: deleteStory })
  }
  if (atlasStory !== undefined && pilotStory !== undefined) {
    stories.addDependency({ blockedStoryId: atlasStory, blockingStoryId: pilotStory })
  }

  for (const plan of REMARK_PLAN) {
    const storyId = storyIds.get(plan.story)
    if (storyId === undefined) {
      continue
    }
    discussion.writeRemark({
      storyId,
      author: plan.author,
      voice: plan.voice,
      body: plan.body,
    })
  }

  const incidents = createIncidentRepository(db, { stories })
  incidents.declareOrigin({ slug: 'sentry', name: 'Sentry', kind: 'sentry' })
  incidents.declareOrigin({ slug: 'support', name: 'Support desk', kind: 'user_report' })
  incidents.declareOrigin({ slug: 'ideas', name: 'Idea box', kind: 'idea' })
  const reported = [
    { originSlug: 'sentry', fingerprint: 'sentry-a1', title: 'Payment webhook times out', detail: 'POST /webhooks/payment exceeded 10 s for 14 requests in the last hour.', repeats: 13 },
    { originSlug: 'sentry', fingerprint: 'sentry-b2', title: 'Undefined subject in the roadmap export', detail: 'TypeError: cannot read title of undefined in RoadmapExport.', repeats: 3 },
    { originSlug: 'support', fingerprint: 'support-c3', title: 'Customer cannot download an invoice', detail: 'The invoice archive returns an empty file for orders before March.', repeats: 1 },
    { originSlug: 'ideas', fingerprint: 'ideas-d4', title: 'Let the board notify me on Slack', detail: 'When a session waits for validation, ping me in a channel.', repeats: 0 },
    { originSlug: 'support', fingerprint: 'support-e5', title: 'Typo on the login page', detail: 'The word "password" is misspelled in French.', repeats: 0 },
  ]
  const written = reported.map((draft) => {
    let incident = incidents.reportIncident(draft)
    for (let again = 0; again < draft.repeats; again += 1) {
      incident = incidents.reportIncident(draft)
    }
    return incident
  })
  const firstEpic = stories.listEpics(projectIds.get('forge') ?? 0)[0]
  if (written[3] !== undefined && firstEpic !== undefined) {
    incidents.acceptIncident(written[3].id, firstEpic.id)
  }
  if (written[4] !== undefined) {
    incidents.refuseIncident(written[4].id, 'Already fixed in the next release')
  }

  budget.writePolicy({ capUsd: 25, conduct: 'downgrade', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
  markSeeded.run(MARKER, new Date().toISOString())

  return {
    projects: stories.listProjects().length,
    stories: stories.listKanban().length,
    sessions: SESSION_PLAN.length,
    zones: ZONE_PLAN.length,
  }
}
