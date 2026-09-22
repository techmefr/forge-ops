import type { SessionContext } from '@/domain/Board/BoardModel'

export type ContextGaugeModel = {
  tokens: number
  window: number | null
  percent: number | null
}

export function contextGaugeOf(context: SessionContext | null): ContextGaugeModel | null {
  if (context === null) {
    return null
  }
  const window = context.window
  return {
    tokens: context.tokens,
    window,
    percent: window === null || window <= 0 ? null : Math.round((context.tokens / window) * 100),
  }
}

export function contextGaugeColour(percent: number | null): string {
  if (percent === null) {
    return 'bg-line'
  }
  if (percent >= 90) {
    return 'bg-red'
  }
  return percent >= 70 ? 'bg-orange' : 'bg-green'
}
