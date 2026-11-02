import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { minutesToWrite, type ProjectEvent } from '@contract/EventContract'
import type { SubjectRow } from './RoadmapBlock'
import type { RoadmapSubject } from './Timeline'

export type RoadmapLabels = ReturnType<typeof useRoadmapLabels>

export function useRoadmapLabels(today: Ref<string>) {
  const { t, locale } = useI18n()

  function dayLabel(day: string, withYear = false): string {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale.value, {
      day: 'numeric',
      month: 'short',
      year: withYear ? 'numeric' : undefined,
      timeZone: 'UTC',
    })
  }

  function typeLabel(event: ProjectEvent): string {
    return t(`milestone.${event.type}`)
  }

  function eventName(event: ProjectEvent): string {
    return event.title === '' ? typeLabel(event) : event.title
  }

  function eventLabel(event: ProjectEvent): string {
    const base = t('roadmap.eventLabel', {
      type: typeLabel(event),
      title: eventName(event),
      date: dayLabel(event.date, true),
    })
    return minutesToWrite(event, today.value) ? `${base}, ${t('roadmap.minutesToWrite')}` : base
  }

  function daysLeftLabel(daysLeft: number): string {
    return daysLeft === 0 ? t('roadmap.today') : t('roadmap.inDays', { days: daysLeft })
  }

  function ownerOf(subject: RoadmapSubject): string {
    return subject.assignee ?? t('roadmap.nobody')
  }

  function barText(row: SubjectRow): string {
    const late = row.bar.lateDays > 0 ? ` · ${t('roadmap.lateBy', { days: row.bar.lateDays })}` : ''
    return `${row.subject.title} · ${dayLabel(row.bar.end)}${late}`
  }

  function barAria(row: SubjectRow): string {
    const base = t('roadmap.barLabel', {
      title: row.subject.title,
      owner: ownerOf(row.subject),
      state: t(`epicState.${row.subject.state}`),
      start: dayLabel(row.bar.start, true),
      end: dayLabel(row.bar.end, true),
    })
    return row.bar.lateDays > 0 ? `${base}, ${t('roadmap.barLate', { days: row.bar.lateDays })}` : base
  }

  return { dayLabel, typeLabel, eventName, eventLabel, daysLeftLabel, ownerOf, barText, barAria }
}
