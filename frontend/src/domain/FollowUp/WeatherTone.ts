import type { Weather } from '@contract/FollowUpContract'

export type WeatherTone = {
  text: string
  chip: string
  icon: string
}

export const WEATHER_TONES: Readonly<Record<Weather, WeatherTone>> = {
  sunny: { text: 'text-green', chip: 'bg-green/10 text-green-soft', icon: 'sun' },
  cloudy: { text: 'text-warn', chip: 'bg-warn/10 text-warn-soft', icon: 'cloud' },
  stormy: { text: 'text-red', chip: 'bg-red/10 text-red-soft', icon: 'storm' },
}
