import { REVIEW_LENS_SEQUENCE, type ReviewLens, type ReviewPass } from './Checkpoint.js'

export const LENS_AGENTS: Readonly<Record<ReviewLens, string>> = {
  quality: 'elrond',
  security: 'seraph',
  accessibility: 'link',
}

export type CascadeStep = {
  dispatched: ReviewLens | null
  reason: string
}

export type CascadeAdvance = {
  cascade: readonly ReviewPass[]
  dispatchLens: (lens: ReviewLens) => Promise<void>
}

export function nextLensOf(cascade: readonly ReviewPass[]): ReviewLens | null {
  return (
    REVIEW_LENS_SEQUENCE.find(
      (lens) => cascade.find((pass) => pass.lens === lens)?.state !== 'passed',
    ) ?? null
  )
}

export function runningLensOf(cascade: readonly ReviewPass[]): ReviewLens | null {
  return cascade.find((pass) => pass.state === 'running')?.lens ?? null
}

export async function advanceCascade({ cascade, dispatchLens }: CascadeAdvance): Promise<CascadeStep> {
  const running = runningLensOf(cascade)
  if (running !== null) {
    return { dispatched: null, reason: `${running} est encore en cours de lecture` }
  }
  const next = nextLensOf(cascade)
  if (next === null) {
    return { dispatched: null, reason: 'la cascade est passee en entier' }
  }
  try {
    await dispatchLens(next)
    return { dispatched: next, reason: `${LENS_AGENTS[next]} lit ${next}` }
  } catch (error) {
    return { dispatched: null, reason: error instanceof Error ? error.message : String(error) }
  }
}
