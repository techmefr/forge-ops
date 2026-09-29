import {
  computedWeather,
  type Weather,
  type WeatherScore,
  type WeatherSource,
} from '../../../../contract/FollowUpContract.js'

export { computedWeather }

export function scoreOf(late: number, blocked: number, highRisks: number): WeatherScore {
  return { late, blocked, highRisks, total: late + blocked + highRisks }
}

export type WeatherReading = {
  weather: Weather
  source: WeatherSource
}

export function weatherOf(score: WeatherScore, override: Weather | null): WeatherReading {
  return override === null
    ? { weather: computedWeather(score), source: 'computed' }
    : { weather: override, source: 'manual' }
}
