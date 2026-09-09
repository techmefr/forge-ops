<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { KanbanStory, ReviewPass, StoryReport, Ticket } from '@/domain/Board/BoardModel'
import { CHECKPOINT_LABELS, LENS_LABELS } from '@/domain/Story/Checkpoint'

const REVIEWABLE_STATES = ['gating', 'reviewing', 'shipping']

const stories = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const openStoryId = ref<number | null>(null)
const ticket = useResource<Ticket | null>(async () =>
  openStoryId.value === null ? null : board.read<Ticket>(`/api/stories/${openStoryId.value}/ticket`),
)
const cascade = useResource<readonly ReviewPass[]>(async () =>
  openStoryId.value === null
    ? []
    : board.read<readonly ReviewPass[]>(`/api/stories/${openStoryId.value}/review`),
)
const report = useResource<StoryReport | null>(async () =>
  openStoryId.value === null ? null : board.read<StoryReport>(`/api/stories/${openStoryId.value}/report`),
)

const evidencePath = ref('')
const checkpointName = ref('verified')
const refusal = ref<string | null>(null)
const busy = ref(false)

const reviewable = computed(() =>
  (stories.data.value ?? []).filter((story) => REVIEWABLE_STATES.includes(story.state)),
)

async function choose(storyId: number): Promise<void> {
  openStoryId.value = storyId
  await Promise.all([ticket.reload(), cascade.reload(), report.reload()])
}

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
  const storyId = openStoryId.value
  return storyId === null
    ? Promise.resolve()
    : guard(async () => {
        await board.send(`/api/stories/${storyId}/review/${lens}/pass`, 'POST')
        await cascade.reload()
      })
}

function prove(): Promise<void> {
  const storyId = openStoryId.value
  return storyId === null
    ? Promise.resolve()
    : guard(async () => {
        await board.send(`/api/stories/${storyId}/checkpoints`, 'POST', {
          name: checkpointName.value,
          evidencePath: evidencePath.value,
        })
        evidencePath.value = ''
        await Promise.all([ticket.reload(), report.reload(), stories.reload()])
      })
}

function satisfy(criterionId: number): Promise<void> {
  return guard(async () => {
    await board.send(`/api/criteria/${criterionId}/satisfy`, 'POST', { evidencePath: evidencePath.value })
    await Promise.all([ticket.reload(), report.reload()])
  })
}

onMounted(() => stories.reload())
</script>

<template>
  <div class="grid h-full min-h-[600px] grid-cols-[280px_minmax(0,1fr)]">
    <section class="border-r border-line p-5">
      <h2 class="display-italic text-sm text-txt-mid">Stories a verifier</h2>
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="reviewable.length === 0"
        empty-label="Rien a verifier pour l instant."
        @retry="stories.reload()"
      >
        <div class="mt-3 flex flex-col gap-2">
          <button
            v-for="story in reviewable"
            :key="story.id"
            type="button"
            class="rounded-xl border bg-card p-3 text-left"
            :class="openStoryId === story.id ? 'border-acc' : 'border-line hover:border-acc'"
            @click="choose(story.id)"
          >
            <span class="font-mono text-[10px] text-acc">{{ story.reference }}</span>
            <span class="mt-1 block text-sm text-txt-hi">{{ story.title }}</span>
          </button>
        </div>
      </ScreenState>
    </section>

    <section class="min-w-0 overflow-auto p-6">
      <p v-if="openStoryId === null" class="text-sm text-txt-low">Choisis une story a verifier.</p>

      <template v-else>
        <section class="rounded-2xl border border-line bg-card p-4">
          <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
            Cascade de review, dans cet ordre
          </p>
          <ol class="mt-3 flex flex-wrap gap-3">
            <li
              v-for="pass in cascade.data.value ?? []"
              :key="pass.lens"
              class="flex min-w-[180px] flex-col gap-1.5 rounded-xl border p-3"
              :class="pass.state === 'passed' ? 'border-green' : 'border-line'"
            >
              <span class="display-italic text-sm">{{ LENS_LABELS[pass.lens] }}</span>
              <span class="font-mono text-[10px] text-txt-low uppercase">{{ pass.state }}</span>
              <span v-if="pass.agentName !== null" class="font-mono text-[10px] text-txt-low">{{
                pass.agentName
              }}</span>
              <button
                v-if="pass.state !== 'passed'"
                type="button"
                :disabled="busy"
                class="mt-1 rounded-lg border border-line bg-elev px-2 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
                @click="passLens(pass.lens)"
              >
                Passer cette lentille
              </button>
            </li>
          </ol>
        </section>

        <form class="mt-5 rounded-2xl border border-line bg-card p-4" @submit.prevent="prove">
          <p class="display-italic text-sm text-txt-mid">Prouver un point de controle</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <select
              v-model="checkpointName"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            >
              <option v-for="(label, name) in CHECKPOINT_LABELS" :key="name" :value="name">
                {{ label }}
              </option>
            </select>
            <input
              v-model="evidencePath"
              type="text"
              placeholder="Chemin de la preuve"
              class="min-w-[240px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
            <button
              type="submit"
              :disabled="busy || evidencePath === ''"
              class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
            >
              Deposer la preuve
            </button>
          </div>
          <p class="mt-2 text-[11px] text-txt-low">
            Une preuve vide est refusee par le board, ce n est pas une case a cocher.
          </p>
        </form>

        <section class="mt-5 rounded-2xl border border-line bg-card p-4">
          <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
            Criteres, la porte du merge
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
                Satisfaire
              </button>
            </li>
          </ul>
        </section>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <section class="rounded-2xl border border-green bg-card p-4">
            <p class="font-mono text-[10px] tracking-[0.18em] text-green uppercase">Faits</p>
            <p v-if="(report.data.value?.facts ?? []).length === 0" class="mt-2 text-xs text-txt-low">
              Aucun fait prouve pour l instant.
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
              Jugements de l IA
            </p>
            <p v-if="(report.data.value?.judgements ?? []).length === 0" class="mt-2 text-xs text-txt-low">
              Aucun jugement en suspens.
            </p>
            <ul class="mt-2 flex flex-col gap-2">
              <li
                v-for="(judgement, index) in report.data.value?.judgements ?? []"
                :key="index"
                class="text-xs text-txt-hi"
              >
                <span class="font-mono text-[10px] text-violet uppercase">{{ judgement.kind }}</span>
                <span class="ml-2">{{ judgement.statement }}</span>
              </li>
            </ul>
          </section>
        </div>

        <p v-if="refusal !== null" class="mt-4 text-xs text-red" role="alert">{{ refusal }}</p>
      </template>
    </section>
  </div>
</template>
