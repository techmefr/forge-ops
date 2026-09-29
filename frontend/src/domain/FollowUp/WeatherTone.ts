import type { Weather } from '@contract/FollowUpContract'

export type WeatherTone = {
  border: string
  text: string
  glyph: string
}

export const WEATHER_TONES: Readonly<Record<Weather, WeatherTone>> = {
  sunny: { border: 'border-l-green', text: 'text-green', glyph: '☀' },
  cloudy: { border: 'border-l-warn', text: 'text-warn', glyph: '☁' },
  stormy: { border: 'border-l-red', text: 'text-red', glyph: '⛈' },
}
