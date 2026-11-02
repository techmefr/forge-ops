import type { DemoContext } from './DemoContext.js'
import { createIncidentRepository } from '../domain/Incident/IncidentRepository.js'
import { createProjectWorkflowRepository } from '../domain/Workflow/ProjectWorkflowRepository.js'
import { HOTFIX_STEPS, MARKER, REMARK_PLAN } from './DemoPlans.js'

export function seedHotfixWorkflow(context: DemoContext): void {
  const { db, stories, workflowColumns, projectIds } = context
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
}

export function seedDependencies(context: DemoContext): void {
  const { stories, storyIds } = context
  const writeStory = storyIds.get('mailer/write')
  const deleteStory = storyIds.get('mailer/delete')
  const atlasStory = storyIds.get('atlas/zones')
  const pilotStory = storyIds.get('forge/pilot')
  if (writeStory !== undefined && deleteStory !== undefined) {
    stories.addDependency({ blockedStoryId: writeStory, blockingStoryId: deleteStory })
  }
  if (atlasStory !== undefined && pilotStory !== undefined) {
    stories.addDependency({ blockedStoryId: atlasStory, blockingStoryId: pilotStory })
  }
}

export function seedRemarks(context: DemoContext): void {
  const { discussion, storyIds } = context
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
}

export function seedIncidents(context: DemoContext): void {
  const { db, stories, projectIds } = context
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
}

export function writeBudgetAndMarker(context: DemoContext): void {
  const { budget, markSeeded } = context
  budget.writePolicy({ capUsd: 25, conduct: 'downgrade', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
  markSeeded.run(MARKER, new Date().toISOString())
}
