import { ref, type Ref } from 'vue'
import { DEADLINE_KINDS } from '@contract/StoryContract'
import type { ProjectEvent } from '@contract/EventContract'
import type { EpicOverview } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { milestoneStep, type SubjectForm } from './SubjectFormRule'

const MILESTONE_KIND = 'production'
const EVENT_TITLE_LIMIT = 120

export function useSubjectMilestone(subject: EpicOverview | null, form: Ref<SubjectForm>) {
  const milestoneEvent = ref<{ id: number; date: string } | null>(null)

  async function loadMilestone(): Promise<void> {
    if (subject === null) {
      return
    }
    const events = await board
      .read<readonly ProjectEvent[]>(`/api/projects/${subject.projectId}/events`)
      .catch(() => [] as readonly ProjectEvent[])
    const own = events
      .filter((event) => event.epicId === subject.id && (DEADLINE_KINDS as readonly string[]).includes(event.type))
      .sort((one, other) => one.date.localeCompare(other.date))
    const match = own.find((event) => event.date === subject.dueOn) ?? own[0]
    if (match !== undefined) {
      milestoneEvent.value = { id: match.id, date: match.date }
      if (form.value.milestone === '') {
        form.value = { ...form.value, milestone: match.date }
      }
    }
  }

  async function writeMilestone(subjectId: number): Promise<void> {
    const existing = milestoneEvent.value
    const step = milestoneStep(existing?.date ?? null, form.value.milestone)
    let createdId: number | null = null
    if (step === 'create') {
      const created = await board.send<ProjectEvent>('/api/events', 'POST', {
        type: MILESTONE_KIND,
        date: form.value.milestone,
        title: form.value.title.trim().slice(0, EVENT_TITLE_LIMIT),
        projectId: form.value.projectId,
        epicId: subjectId,
      })
      createdId = created.id
    } else if (step === 'change' && existing !== null) {
      await board.send(`/api/events/${existing.id}`, 'PATCH', { date: form.value.milestone })
    } else if (step === 'remove' && existing !== null) {
      await board.send(`/api/events/${existing.id}`, 'DELETE')
    }
    milestoneEvent.value =
      form.value.milestone === '' ? null : { id: createdId ?? existing?.id ?? 0, date: form.value.milestone }
  }

  return { loadMilestone, writeMilestone }
}
