import type { FileMark } from './FileMarkTone.js'

export type FileVerdictView = {
  mark: FileMark
  byReferences: readonly string[]
  agentName: string | null
}

export type SaidTranslate = (
  key: string,
  values: Readonly<Record<string, string | number>>,
  count: number,
) => string

const NAMED_MARKS: readonly FileMark[] = ['planned', 'created']

export function saidKeyOf(verdict: FileVerdictView): string | null {
  if (verdict.mark === 'quiet' || verdict.byReferences.length === 0) {
    return null
  }
  const alone = verdict.byReferences.length === 1 && verdict.agentName !== null
  return `fileSaid.${verdict.mark}${alone && NAMED_MARKS.includes(verdict.mark) ? 'By' : ''}`
}

export function whoOf(references: readonly string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format([...references])
}

export function saidOf(
  verdict: FileVerdictView,
  locale: string,
  translate: SaidTranslate,
): string {
  const key = saidKeyOf(verdict)
  if (key === null) {
    return ''
  }
  return translate(
    key,
    { who: whoOf(verdict.byReferences, locale), agent: verdict.agentName ?? '' },
    verdict.byReferences.length,
  )
}
