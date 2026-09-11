import { phrase, type Phrase } from '@/technical/Language/Phrase'

export function provisionalTitle(written: number): Phrase {
  return phrase('story.provisionalTitle', { number: written + 1 })
}
