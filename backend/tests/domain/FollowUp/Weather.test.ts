import { describe, expect, it } from 'vitest'
import { computedWeather, scoreOf, weatherOf } from '../../../src/domain/FollowUp/Weather.js'

describe('weather score', () => {
  it('adds late subjects, blocked subjects and open high risks', () => {
    expect(scoreOf(2, 1, 3)).toEqual({ late: 2, blocked: 1, highRisks: 3, total: 6 })
  })
})

describe('computed weather', () => {
  it.each([
    [0, 'sunny'],
    [1, 'cloudy'],
    [3, 'cloudy'],
    [4, 'stormy'],
    [9, 'stormy'],
  ])('is %i points of score -> %s', (total, expected) => {
    expect(computedWeather({ late: total, blocked: 0, highRisks: 0, total })).toBe(expected)
  })
})

describe('weather reading', () => {
  const stormy = scoreOf(4, 0, 0)

  it('follows the score when nothing was set by hand', () => {
    expect(weatherOf(stormy, null)).toEqual({ weather: 'stormy', source: 'computed' })
  })

  it('keeps the weather set by hand whatever the score', () => {
    expect(weatherOf(stormy, 'sunny')).toEqual({ weather: 'sunny', source: 'manual' })
  })
})
