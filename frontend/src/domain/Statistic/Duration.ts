export function humanDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'en cours'
  }
  if (seconds < 60) {
    return `${seconds} s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min ${seconds % 60} s`
  }
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
