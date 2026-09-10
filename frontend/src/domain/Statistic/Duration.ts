export function humanDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'en cours'
  }
  if (seconds < 60) {
    return `${seconds} s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
  }
  const restingMinutes = minutes % 60
  const hours = Math.floor(minutes / 60)
  return restingMinutes === 0 ? `${hours} h` : `${hours} h ${restingMinutes} min`
}
