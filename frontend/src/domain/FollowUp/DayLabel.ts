export function dayLabel(day: string, locale: string, withYear = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
}
