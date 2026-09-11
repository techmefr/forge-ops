const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function twoDigits(value: number): string {
  return value.toString().padStart(2, '0')
}

function readUtc(said: string): Date {
  const spaced = said.includes('T') ? said : said.replace(' ', 'T')
  return new Date(spaced.endsWith('Z') || spaced.includes('+') ? spaced : `${spaced}Z`)
}

export function saidWhen(written: string, now: Date): string {
  const moment = readUtc(written)
  if (Number.isNaN(moment.getTime())) {
    return 'date inconnue'
  }
  const gone = now.getTime() - moment.getTime()
  if (gone < MINUTE) {
    return 'a l instant'
  }
  if (gone < HOUR) {
    return `il y a ${Math.floor(gone / MINUTE)} min`
  }
  if (gone < DAY) {
    return `il y a ${Math.floor(gone / HOUR)} h`
  }
  return `le ${twoDigits(moment.getDate())}/${twoDigits(moment.getMonth() + 1)} a ${twoDigits(
    moment.getHours(),
  )}:${twoDigits(moment.getMinutes())}`
}
