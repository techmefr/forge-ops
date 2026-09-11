import { phrase, type Phrase } from '@/technical/Language/Phrase'

export function humanDuration(seconds: number | null): Phrase {
  if (seconds === null) {
    return phrase('duration.running')
  }
  if (seconds < 60) {
    return phrase('duration.seconds', { count: seconds })
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0
      ? phrase('duration.minutes', { count: minutes })
      : phrase('duration.minutesSeconds', { minutes, seconds: rest })
  }
  const restingMinutes = minutes % 60
  const hours = Math.floor(minutes / 60)
  return restingMinutes === 0
    ? phrase('duration.hours', { count: hours })
    : phrase('duration.hoursMinutes', { hours, minutes: restingMinutes })
}
