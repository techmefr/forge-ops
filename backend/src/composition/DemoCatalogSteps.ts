import type { DemoContext } from './DemoContext.js'
import { randomBytes } from 'node:crypto'
import type { EpicPatch } from '../../../contract/EpicContract.js'
import { describeZone } from '../domain/Zone/ZoneDigest.js'
import { DEMO_STEPS, PLAN, PROJECT_EXTRAS, SPARE_EPICS, TAG_PLAN, USER_PLAN, ZONE_PLAN, dayFromNow, milestonesOf } from './DemoPlans.js'

export function seedPeople(context: DemoContext): void {
  const { stories, identities, tagIds } = context
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
  for (const tag of TAG_PLAN) {
    tagIds.set(tag.label, stories.epics.createTag(tag).id)
  }
}

export function seedProjects(context: DemoContext): void {
  const { stories, criteria, workflowColumns, storyIds, references, projectIds } = context
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
}

export function seedSpareEpics(context: DemoContext): void {
  const { stories, projectIds, tagIds } = context
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
}

export function seedProjectFollowUps(context: DemoContext): void {
  const { stories, identities, projectIds } = context
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
}

export function seedZones(context: DemoContext): void {
  const { stories, zones } = context
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
}
