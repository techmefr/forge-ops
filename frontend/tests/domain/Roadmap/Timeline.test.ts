import { describe, expect, it } from 'vitest'
import type { ProjectEvent } from '@contract/EventContract'
import {
  addDays,
  barOf,
  daysBetween,
  eventsToWrite,
  lanesOf,
  labelPlacement,
  labelWidthPercent,
  localDay,
  percentOf,
  subjectsWithoutDates,
  ticksOf,
  upcomingOf,
  windowOf,
  type RoadmapSubject,
} from '@/domain/Roadmap/Timeline'

const TODAY = '2026-09-28'

function subject(over: Partial<RoadmapSubject> = {}): RoadmapSubject {
  return { id: 1, title: 'Cloudmail', assignee: 'gaetan', startedOn: '2026-09-01', state: 'doing', ...over }
}

function event(over: Partial<ProjectEvent> = {}): ProjectEvent {
  return {
    id: 1,
    type: 'demo',
    date: '2026-10-10',
    title: '',
    projectId: 1,
    epicId: 1,
    note: null,
    minutes: null,
    minutesUpdatedAt: null,
    ...over,
  }
}

describe('calendar arithmetic', () => {
  it('adds and counts days without any timezone drift', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-09-28', '2026-10-06')).toBe(8)
    expect(daysBetween('2026-10-06', '2026-09-28')).toBe(-8)
  })

  it('reads today in the local calendar of the user', () => {
    expect(localDay(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28')
    expect(localDay(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
})

describe('the bar of a subject', () => {
  it('runs from the start to the next milestone not yet passed', () => {
    const bar = barOf(
      subject(),
      [event({ id: 1, date: '2026-09-10' }), event({ id: 2, type: 'production', date: '2026-10-20' }), event({ id: 3, type: 'everyone', date: '2026-11-30' })],
      TODAY,
    )
    expect(bar).toMatchObject({ start: '2026-09-01', end: '2026-10-20', milestoneId: 2, lateUntil: null })
  })

  it('runs to the last milestone when all are passed', () => {
    const bar = barOf(
      subject({ state: 'done' }),
      [event({ id: 1, date: '2026-09-10' }), event({ id: 2, type: 'production', date: '2026-09-20' })],
      TODAY,
    )
    expect(bar).toMatchObject({ end: '2026-09-20', milestoneId: 2, lateUntil: null })
  })

  it('counts a milestone falling today as not yet passed', () => {
    const bar = barOf(subject(), [event({ date: TODAY })], TODAY)
    expect(bar).toMatchObject({ end: TODAY, lateUntil: null })
  })

  it('hatches from the milestone to today when a live subject missed every milestone', () => {
    const bar = barOf(subject(), [event({ date: '2026-09-20' })], TODAY)
    expect(bar).toMatchObject({ end: '2026-09-20', lateUntil: TODAY, lateDays: 8 })
  })

  it('never hatches a subject that is done or in the trash', () => {
    for (const state of ['done', 'trash'] as const) {
      expect(barOf(subject({ state }), [event({ date: '2026-09-20' })], TODAY)?.lateUntil).toBeNull()
    }
  })

  it('ignores meetings that are not deadlines and events of other subjects', () => {
    const bar = barOf(
      subject(),
      [
        event({ id: 1, type: 'client', date: '2026-10-01' }),
        event({ id: 2, type: 'steering', epicId: null, date: '2026-10-02' }),
        event({ id: 3, epicId: 2, date: '2026-10-03' }),
        event({ id: 4, date: '2026-10-15' }),
      ],
      TODAY,
    )
    expect(bar).toMatchObject({ end: '2026-10-15', milestoneId: 4 })
  })

  it('has no bar without a start date or without a milestone', () => {
    expect(barOf(subject({ startedOn: null }), [event()], TODAY)).toBeNull()
    expect(barOf(subject(), [], TODAY)).toBeNull()
    expect(barOf(subject(), [event({ type: 'client' })], TODAY)).toBeNull()
  })

  it('never ends before it starts', () => {
    const bar = barOf(subject({ startedOn: '2026-10-05' }), [event({ date: '2026-10-01' })], TODAY)
    expect(bar).toMatchObject({ start: '2026-10-05', end: '2026-10-05' })
  })
})

describe('the subjects listed under the chart', () => {
  it('lists live subjects with no start or no milestone, not the finished ones', () => {
    const subjects = [
      subject({ id: 1 }),
      subject({ id: 2, startedOn: null }),
      subject({ id: 3 }),
      subject({ id: 4, startedOn: null, state: 'done' }),
      subject({ id: 5, startedOn: null, state: 'trash' }),
    ]
    const events = [event({ epicId: 1 })]
    expect(subjectsWithoutDates(subjects, events, TODAY).map((entry) => entry.id)).toEqual([2, 3])
  })
})

describe('the window of the chart', () => {
  it('holds every date of the data and today, with room around them', () => {
    const view = windowOf(['2026-09-01', '2026-10-20'], TODAY)
    expect(view.from <= '2026-09-01').toBe(true)
    expect(view.to >= '2026-10-20').toBe(true)
  })

  it('is never narrower than four weeks, even with nothing to show', () => {
    const view = windowOf([], TODAY)
    expect(daysBetween(view.from, view.to)).toBeGreaterThanOrEqual(28)
    expect(view.from <= TODAY && view.to >= TODAY).toBe(true)
  })

  it('places a date as a percentage of the window and keeps it inside', () => {
    const view = { from: '2026-09-01', to: '2026-10-01' }
    expect(percentOf('2026-09-01', view)).toBe(0)
    expect(percentOf('2026-09-16', view)).toBe(50)
    expect(percentOf('2026-10-01', view)).toBe(100)
    expect(percentOf('2026-08-01', view)).toBe(0)
    expect(percentOf('2026-12-01', view)).toBe(100)
  })

  it('draws weekly ticks over a short window and monthly ticks over a long one', () => {
    const short = ticksOf({ from: '2026-09-01', to: '2026-10-10' })
    expect(short.every((tick) => new Date(`${tick}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
    expect(short.length).toBeGreaterThan(4)
    const long = ticksOf({ from: '2026-01-15', to: '2026-12-31' })
    expect(long.every((tick) => tick.endsWith('-01'))).toBe(true)
    expect(long).toHaveLength(11)
  })
})

describe('the label of a bar', () => {
  it('sits inside a bar wide enough for it', () => {
    expect(labelPlacement({ left: 10, width: 30, lateWidth: 0 })).toEqual({ inside: true })
  })

  it('sits outside on the right of a short bar', () => {
    expect(labelPlacement({ left: 10, width: 4, lateWidth: 0 })).toEqual({ inside: false, flip: false, at: 14.6 })
  })

  it('counts the hatched part in where the label goes', () => {
    expect(labelPlacement({ left: 10, width: 4, lateWidth: 6 })).toEqual({ inside: false, flip: false, at: 20.6 })
  })

  it('flips to the left near the right edge', () => {
    expect(labelPlacement({ left: 85, width: 4, lateWidth: 0 })).toEqual({ inside: false, flip: true, at: 15.6 })
  })
})

describe('the labels of the events on a project band', () => {
  it('staggers events that are close and keeps distant ones on the first lane', () => {
    const view = { from: '2026-09-01', to: '2026-11-01' }
    const lanes = lanesOf(
      [event({ id: 1, date: '2026-09-10' }), event({ id: 2, date: '2026-09-11' }), event({ id: 3, date: '2026-09-12' }), event({ id: 4, date: '2026-10-25' })],
      view,
    )
    expect(lanes.get(1)).toBe(0)
    expect(lanes.get(2)).toBe(1)
    expect(lanes.get(3)).toBe(2)
    expect(lanes.get(4)).toBe(0)
  })

  it('moves a label to the next lane when its text would run into the previous one', () => {
    const view = { from: '2026-09-01', to: '2026-11-01' }
    const events = [event({ id: 1, date: '2026-09-10' }), event({ id: 2, date: '2026-09-14' }), event({ id: 3, date: '2026-10-05' })]
    const narrow = new Map(events.map((one) => [one.id, labelWidthPercent('Demo', 800)]))
    const wide = new Map(events.map((one) => [one.id, labelWidthPercent('Steering committee', 360)]))
    expect([...lanesOf(events, view, narrow).values()]).toEqual([0, 0, 0])
    expect([...lanesOf(events, view, wide).values()]).toEqual([0, 1, 0])
  })

  it('gives every label of a crowded band a lane where it touches no other label', () => {
    const view = { from: '2026-09-01', to: '2026-10-01' }
    const events = Array.from({ length: 8 }, (_, index) => event({ id: index + 1, date: addDays('2026-09-05', index * 2) }))
    const widths = new Map(events.map((one) => [one.id, labelWidthPercent('Client meeting', 340)]))
    const lanes = lanesOf(events, view, widths)
    for (const one of events) {
      for (const other of events) {
        if (one.id >= other.id || lanes.get(one.id) !== lanes.get(other.id)) {
          continue
        }
        const gap = Math.abs(percentOf(one.date, view) - percentOf(other.date, view))
        expect(gap).toBeGreaterThanOrEqual(labelWidthPercent('Client meeting', 340))
      }
    }
  })

  it('is stable whatever the order of the events', () => {
    const view = { from: '2026-09-01', to: '2026-11-01' }
    const events = [event({ id: 1, date: '2026-09-10' }), event({ id: 2, date: '2026-09-11' }), event({ id: 3, date: '2026-09-12' })]
    const forward = lanesOf(events, view)
    const backward = lanesOf([...events].reverse(), view)
    expect([...forward.entries()].sort()).toEqual([...backward.entries()].sort())
  })
})

describe('upcoming events', () => {
  it('lists events from today on, soonest first, with the days left', () => {
    const list = upcomingOf(
      [event({ id: 1, date: '2026-10-06' }), event({ id: 2, date: '2026-09-27' }), event({ id: 3, date: TODAY }), event({ id: 4, date: '2026-09-30' })],
      TODAY,
    )
    expect(list.map((entry) => [entry.event.id, entry.daysLeft])).toEqual([
      [3, 0],
      [4, 2],
      [1, 8],
    ])
  })

  it('can be capped', () => {
    const many = Array.from({ length: 12 }, (_, index) => event({ id: index + 1, date: addDays(TODAY, index) }))
    expect(upcomingOf(many, TODAY, 5)).toHaveLength(5)
  })
})

describe('minutes to write', () => {
  it('keeps the past events whose minutes are empty', () => {
    const list = eventsToWrite(
      [
        event({ id: 1, date: '2026-09-20' }),
        event({ id: 2, date: '2026-09-20', minutes: 'Done' }),
        event({ id: 3, date: TODAY }),
        event({ id: 4, date: '2026-09-27', minutes: '  ' }),
      ],
      TODAY,
    )
    expect(list.map((entry) => entry.id)).toEqual([1, 4])
  })
})
