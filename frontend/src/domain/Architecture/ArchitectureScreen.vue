<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { KanbanStory, Ticket } from '@/domain/Board/BoardModel'
import { useTranscript } from '@/domain/Session/UseTranscript'
import { CHECKPOINT_LABELS } from '@/domain/Story/Checkpoint'

const PLANNING_STATES = ['architecture', 'plan_review']

const stories = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const openStoryId = ref<number | null>(null)
const ticket = useResource<Ticket | null>(async () =>
  openStoryId.value === null ? null : board.read<Ticket>(`/api/stories/${openStoryId.value}/ticket`),
)
const refusal = ref<string | null>(null)
const busy = ref(false)
const evidencePath = ref('')

const planning = computed(() =>
  (stories.data.value ?? []).filter((story) => PLANNING_STATES.includes(story.state)),
)

const reference = computed(() => ticket.data.value?.functional.reference ?? null)
const transcript = useTranscript(reference)
const said = computed(() => transcript.visible())

async function choose(storyId: number): Promise<void> {
  openStoryId.value = storyId
  await ticket.reload()
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

function askPlan(): Promise<void> {
  const storyId = openStoryId.value
  return storyId === null
    ? Promise.resolve()
    : guard(() => board.send(`/api/stories/${storyId}/dispatch`, 'POST', { phase: 'architecture' }))
}

function acceptPlan(): Promise<void> {
  const storyId = openStoryId.value
  if (storyId === null) {
    return Promise.resolve()
  }
  return guard(async () => {
    await board.send(`/api/stories/${storyId}/checkpoints`, 'POST', {
      name: 'arch_done',
      evidencePath: evidencePath.value,
    })
    evidencePath.value = ''
    await ticket.reload()
    await stories.reload()
  })
}

onMounted(() => stories.reload())
</script>

<template>
  <div class="grid h-full min-h-[600px] grid-cols-[300px_minmax(0,1fr)]">
    <section class="border-r border-line p-5">
      <h2 class="display-italic text-sm text-txt-mid">Stories en architecture</h2>
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="planning.length === 0"
        empty-label="Rien en architecture. Envoie des stories depuis le backlog."
        @retry="stories.reload()"
      >
        <div class="mt-3 flex flex-col gap-2">
          <button
            v-for="story in planning"
            :key="story.id"
            type="button"
            class="rounded-xl border bg-card p-3 text-left"
            :class="openStoryId === story.id ? 'border-acc' : 'border-line hover:border-acc'"
            @click="choose(story.id)"
          >
            <span class="font-mono text-[10px] text-acc">{{ story.reference }}</span>
            <span class="mt-1 block text-sm text-txt-hi">{{ story.title }}</span>
            <span class="mt-1 block font-mono text-[10px] text-txt-low uppercase">{{ story.state }}</span>
          </button>
        </div>
      </ScreenState>
    </section>

    <section class="min-w-0 overflow-auto p-6">
      <p v-if="ticket.data.value === null" class="text-sm text-txt-low">
        Choisis une story pour lire son plan.
      </p>

      <template v-else>
        <header class="rounded-2xl border border-line bg-card p-4">
          <span class="font-mono text-[11px] text-acc">{{ ticket.data.value.functional.reference }}</span>
          <h2 class="display-italic mt-1 text-xl">{{ ticket.data.value.functional.title }}</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="busy"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
              @click="askPlan()"
            >
              Demander un plan
            </button>
          </div>
        </header>

        <section class="mt-5 rounded-2xl border border-line bg-card p-4">
          <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Ce que dit Claude</p>
          <p v-if="said.length === 0" class="mt-2 text-xs text-txt-low">
            Aucun plan encore. Lance la phase d architecture.
          </p>
          <article
            v-for="(utterance, index) in said"
            :key="index"
            class="mt-3 border-t border-line pt-3 first:border-0 first:pt-0"
          >
            <p class="font-mono text-[10px] text-txt-low uppercase">{{ utterance.name }}</p>
            <p v-if="utterance.text !== null" class="mt-1 text-sm whitespace-pre-wrap text-txt-hi">
              {{ utterance.text }}
            </p>
          </article>
        </section>

        <form class="mt-5 rounded-2xl border border-acc bg-card p-4" @submit.prevent="acceptPlan">
          <p class="display-italic text-sm text-acc">Valider le plan</p>
          <p class="mt-1 text-xs text-txt-low">
            Le point de controle {{ CHECKPOINT_LABELS.arch_done }} exige une preuve deposee quelque part.
          </p>
          <input
            v-model="evidencePath"
            type="text"
            placeholder="docs/plan/FORGE-1.md"
            class="mt-3 w-full rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <button
            type="submit"
            :disabled="busy || evidencePath === ''"
            class="mt-3 rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
          >
            Le plan tient
          </button>
        </form>

        <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ refusal }}</p>
      </template>
    </section>
  </div>
</template>
