<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import {
  CHECKPOINT_SEQUENCE,
  type CheckpointName,
  type KanbanStory,
  type ReviewPass,
  type StoryReport,
  type Ticket,
} from '@/domain/Board/BoardModel'

const props = defineProps<{ story: KanbanStory }>()
const emit = defineEmits<{ moved: [] }>()

const { t } = useI18n()
const say = usePhrase()

const ticket = useResource<Ticket>(() => board.read(`/api/stories/${props.story.id}/ticket`))
const cascade = useResource<readonly ReviewPass[]>(() =>
  board.read(`/api/stories/${props.story.id}/review`),
)
const report = useResource<StoryReport>(() => board.read(`/api/stories/${props.story.id}/report`))

const evidencePath = ref('')
const checkpointName = ref<CheckpointName>('verified')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function passLens(lens: string): Promise<void> {
  return guard(async () => {
    await board.send(`/api/stories/${props.story.id}/review/${lens}/pass`, 'POST')
    await cascade.reload()
  })
}

function prove(): Promise<void> {
  return guard(async () => {
    await board.send(`/api/stories/${props.story.id}/checkpoints`, 'POST', {
      name: checkpointName.value,
      evidencePath: evidencePath.value,
    })
    evidencePath.value = ''
    await Promise.all([ticket.reload(), report.reload()])
    emit('moved')
  })
}

function satisfy(criterionId: number): Promise<void> {
  return guard(async () => {
    await board.send(`/api/criteria/${criterionId}/satisfy`, 'POST', {
      evidencePath: evidencePath.value,
    })
    await Promise.all([ticket.reload(), report.reload()])
  })
}

watch(
  () => props.story.id,
  () => Promise.all([ticket.reload(), cascade.reload(), report.reload()]),
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('reviewTab.cascadeOrder') }}
      </p>
      <ol class="mt-3 flex flex-col gap-3">
        <li
          v-for="pass in cascade.data.value ?? []"
          :key="pass.lens"
          class="flex flex-col gap-1.5 rounded-xl border p-3"
          :class="pass.state === 'passed' ? 'border-green' : 'border-line'"
        >
          <span class="display-italic text-sm">{{ t(`lens.${pass.lens}`) }}</span>
          <span class="font-mono text-[10px] text-txt-low uppercase">{{
            t(`reviewPassState.${pass.state}`)
          }}</span>
          <span v-if="pass.agentName !== null" class="font-mono text-[10px] text-txt-low">{{
            pass.agentName
          }}</span>
          <button
            v-if="pass.state !== 'passed'"
            type="button"
            :disabled="busy"
            class="mt-1 self-start rounded-lg border border-line bg-elev px-2 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="passLens(pass.lens)"
          >
            {{ t('reviewTab.passLens') }}
          </button>
        </li>
      </ol>
    </section>

    <form class="rounded-2xl border border-line bg-card p-4" @submit.prevent="prove">
      <p class="display-italic text-sm text-txt-mid">{{ t('reviewTab.proveCheckpoint') }}</p>
      <div class="mt-3 flex flex-col gap-2">
        <select
          v-model="checkpointName"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        >
          <option v-for="name in CHECKPOINT_SEQUENCE" :key="name" :value="name">
            {{ t(`checkpoint.${name}`) }}
          </option>
        </select>
        <input
          v-model="evidencePath"
          type="text"
          :placeholder="t('reviewTab.evidencePlaceholder')"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
        <button
          type="submit"
          :disabled="busy || evidencePath === ''"
          class="self-start rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ t('reviewTab.dropEvidence') }}
        </button>
      </div>
      <p class="mt-2 text-[11px] text-txt-low">{{ t('reviewTab.emptyEvidenceRefused') }}</p>
    </form>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('reviewTab.criteriaGate') }}
      </p>
      <ul class="mt-2 flex flex-col gap-2">
        <li
          v-for="criterion in ticket.data.value?.criteria ?? []"
          :key="criterion.id"
          class="flex items-center gap-2 text-xs"
        >
          <span
            class="h-2 w-2 flex-none rounded-full"
            :class="criterion.satisfied ? 'bg-green' : 'bg-line'"
          />
          <span class="font-mono text-[10px] text-txt-low">{{ criterion.reference }}</span>
          <span class="text-txt-hi">{{ criterion.statement }}</span>
          <button
            v-if="!criterion.satisfied"
            type="button"
            :disabled="busy || evidencePath === ''"
            class="ml-auto rounded-lg border border-line bg-elev px-2 py-1 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="satisfy(criterion.id)"
          >
            {{ t('reviewTab.satisfy') }}
          </button>
        </li>
      </ul>
    </section>

    <section class="rounded-2xl border border-green bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-green uppercase">
        {{ t('reviewTab.facts') }}
      </p>
      <p v-if="(report.data.value?.facts ?? []).length === 0" class="mt-2 text-xs text-txt-low">
        {{ t('reviewTab.noFacts') }}
      </p>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="(fact, index) in report.data.value?.facts ?? []" :key="index" class="text-xs">
          <span class="text-txt-hi">{{ fact.statement }}</span>
          <span v-if="fact.kind !== 'cost'" class="ml-2 font-mono text-[10px] text-acc">{{
            fact.evidencePath
          }}</span>
        </li>
      </ul>
    </section>

    <section class="rounded-2xl border border-violet bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-violet uppercase">
        {{ t('reviewTab.judgements') }}
      </p>
      <p v-if="(report.data.value?.judgements ?? []).length === 0" class="mt-2 text-xs text-txt-low">
        {{ t('reviewTab.noJudgements') }}
      </p>
      <ul class="mt-2 flex flex-col gap-2">
        <li
          v-for="(judgement, index) in report.data.value?.judgements ?? []"
          :key="index"
          class="text-xs text-txt-hi"
        >
          <span class="font-mono text-[10px] text-violet uppercase">{{
            t(`judgement.${judgement.kind}`)
          }}</span>
          <span class="ml-2">{{ judgement.statement }}</span>
        </li>
      </ul>
    </section>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>
  </div>
</template>
