import type { Language } from '../Language.js'
import { ENGLISH } from './English.js'
import { FRENCH } from './French.js'
import { GERMAN } from './German.js'
import { ITALIAN } from './Italian.js'
import { PORTUGUESE } from './Portuguese.js'
import { SPANISH } from './Spanish.js'
import type { Message } from './Message.js'

export const MESSAGES: Readonly<Record<Language, Message>> = {
  de: GERMAN,
  en: ENGLISH,
  es: SPANISH,
  fr: FRENCH,
  it: ITALIAN,
  pt: PORTUGUESE,
}
