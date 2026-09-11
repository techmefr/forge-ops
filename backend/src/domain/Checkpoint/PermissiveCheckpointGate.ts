import { EVIDENCE_SHAPE, MINIMUM_PROSE_WORDS } from '../Evidence/EvidenceShape.js'
import type { EvidenceReader } from '../Evidence/EvidenceRead.js'
import type { MutationOutcome } from '../Mutation/Mutation.js'
import type { TestReport } from '../RedProof/RedProof.js'

const PROSE = Array.from({ length: MINIMUM_PROSE_WORDS }, (_unused, index) => `mot${index}`).join(' ')

const EVERY_SECTION = Object.values(EVIDENCE_SHAPE)
  .flat()
  .map((section) => `## ${section}`)
  .join('\n')

const ACCEPTED_EVIDENCE = `${EVERY_SECTION}\n\n${PROSE}\n`

const ASSERTED_RED: TestReport = {
  files: [
    {
      name: 'permissive/gate.test.ts',
      message: '',
      assertions: [
        {
          fullName: 'la porte est ouverte',
          status: 'failed',
          failureMessages: ['AssertionError: la porte est ouverte'],
        },
      ],
    },
  ],
}

export const permissiveEvidenceReader: EvidenceReader = () => ({
  kind: 'read',
  content: ACCEPTED_EVIDENCE,
})

export const permissiveMutationSurvey = (): readonly MutationOutcome[] => []

export const permissiveRedSurvey = (): TestReport => ASSERTED_RED

export const PERMISSIVE_CHECKPOINT_GATES = {
  readEvidence: permissiveEvidenceReader,
  surveyMutations: permissiveMutationSurvey,
  surveyRed: permissiveRedSurvey,
}
