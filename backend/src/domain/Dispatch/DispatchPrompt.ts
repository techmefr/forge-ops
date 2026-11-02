import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { stepBriefOf } from '../Autopilot/StepBrief.js'
import { EVIDENCE_SHAPE } from '../Evidence/EvidenceShape.js'
import type { Story } from '../Story/Story.js'
import type { DispatchOrder, PhaseContract } from './Dispatch.js'
import type { Admission } from './DispatchAdmission.js'
import type { OpenCard } from './DispatchGuards.js'
import type { ResolvedDispatch } from './DispatchContract.js'
import type { StoryRepository } from '../Story/StoryRepository.js'

export type BuiltPrompt = {
  reference: string
  prompt: string
  model: string | undefined
  stepSettings: { provider?: string; effort?: string }
}

type PromptInput = {
  stories: StoryRepository
  criteria: CriterionRepository
  doctrineFor: (storyId: number, command: string) => string | null
}

function promptFor(
  story: Story,
  contract: PhaseContract,
  lens: string | undefined,
  preprompt: string,
  doctrineText: string | null,
  brief: readonly string[],
  proveByFile: boolean,
): string {
  const doctrine = contract.command.endsWith('.md')
    ? doctrineText === null
      ? `Follow the doctrine of .claude/commands/${contract.command}.`
      : `Follow this doctrine (${contract.command}):\n\n${doctrineText}\n`
    : `Use the command ${contract.command}.`
  const sections =
    contract.proves === null || !proveByFile
      ? []
      : [
          `Prove ${contract.proves} with a file under .claude/evidence/${story.reference}/ whose section headings carry: ${EVIDENCE_SHAPE[contract.proves].join(', ')}.`,
        ]
  return [
    ...(preprompt.trim() === '' ? [] : [preprompt, ``]),
    `Story ${story.reference} - ${story.title}`,
    ``,
    story.body,
    ``,
    lens === undefined
      ? `Phase: ${contract.phase}. ${doctrine}`
      : `Phase: ${contract.phase}, lens ${lens}. ${doctrine} Read only this lens.`,
    ...sections,
    ...brief,
  ].join('\n')
}

export function createPromptBuilder({ stories, criteria, doctrineFor }: PromptInput) {
  function referenceOf(story: Story, forgeCard: OpenCard | null): string {
    return forgeCard === null
      ? story.reference
      : `${forgeCard.reference} (${forgeCard.storyIds.map((cardStoryId) => stories.findStory(cardStoryId).reference).join(', ')})`
  }

  function briefOf(order: DispatchOrder, { story, step, contract }: ResolvedDispatch): readonly string[] {
    if (step === null || order.lens !== undefined) {
      return []
    }
    return stepBriefOf({
      storyReference: story.reference,
      stepKey: step.key,
      proves: contract.proves,
      phase: order.phase,
      criteriaReferences: criteria.listCriteria(order.storyId).map((criterion) => criterion.reference),
      feedback: order.feedback,
    })
  }

  function build(order: DispatchOrder, resolved: ResolvedDispatch, forgeCard: OpenCard | null, { decision }: Admission): BuiltPrompt {
    const { story, step, configured, contract } = resolved
    const prompt = promptFor(
      story,
      contract,
      order.lens,
      step === null ? (configured?.preprompt ?? '') : step.preprompt,
      contract.command.endsWith('.md') ? doctrineFor(order.storyId, contract.command) : null,
      briefOf(order, resolved),
      step === null || order.lens !== undefined,
    )
    return {
      reference: referenceOf(story, forgeCard),
      prompt,
      model: decision.model ?? (step === null || step.model === '' ? undefined : step.model),
      stepSettings: {
        ...(step === null ? {} : { provider: step.provider }),
        ...(step === null || step.effort === '' ? {} : { effort: step.effort }),
      },
    }
  }

  return { build }
}
