import { phrase, type Phrase } from '@/technical/Language/Phrase'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type Moment = { said: Phrase | null; date: Date | null }

function readUtc(said: string): Date {
  const spaced = said.includes('T') ? said : said.replace(' ', 'T')
  return new Date(spaced.endsWith('Z') || spaced.includes('+') ? spaced : `${spaced}Z`)
}

export function saidWhen(written: string, now: Date): Moment {
  const moment = readUtc(written)
  if (Number.isNaN(moment.getTime())) {
    return { said: phrase('moment.unknown'), date: null }
  }
  const gone = now.getTime() - moment.getTime()
  if (gone < MINUTE) {
    return { said: phrase('moment.justNow'), date: null }
  }
  if (gone < HOUR) {
    return { said: phrase('moment.minutesAgo', { count: Math.floor(gone / MINUTE) }), date: null }
  }
  if (gone < DAY) {
    return { said: phrase('moment.hoursAgo', { count: Math.floor(gone / HOUR) }), date: null }
  }
  return { said: null, date: moment }
}
