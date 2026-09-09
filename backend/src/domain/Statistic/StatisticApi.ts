import { Hono } from 'hono'
import type { StatisticRepository } from './StatisticRepository.js'

export type StatisticApiInput = {
  statistics: StatisticRepository
}

export function createStatisticApi({ statistics }: StatisticApiInput): Hono {
  const api = new Hono()

  api.get('/api/sessions/history', (context) => context.json(statistics.listHistory()))

  api.get('/api/statistics', (context) => context.json(statistics.summarise()))

  return api
}
