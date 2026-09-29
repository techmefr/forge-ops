import type { EventType } from '@contract/EventContract'

export type EventTone = {
  mark: string
  text: string
}

export const EVENT_TONES: Readonly<Record<EventType, EventTone>> = {
  demo: { mark: 'bg-violet', text: 'text-violet' },
  client: { mark: 'bg-info', text: 'text-info' },
  production: { mark: 'bg-green', text: 'text-green' },
  steering: { mark: 'bg-orange', text: 'text-orange' },
  other: { mark: 'bg-txt-mid', text: 'text-txt-mid' },
  everyone: { mark: 'bg-acc', text: 'text-acc' },
}
