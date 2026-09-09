<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { KanbanStory, MergeCleanup, Worktree } from '@/domain/Board/BoardModel'
import { STATE_LABELS } from '@/domain/Story/Checkpoint'

const SHIPPING_STATES = ['building', 'gating', 'reviewing', 'shipping', 'flagged', 'done']

const stories = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const worktrees = useResource<readonly Worktree[]>(() => board.read('/api/worktrees'))
const percents = ref<Map<number, number>>(new Map())
const baseRef = ref('forge')
const refusal = ref<string | null>(null)
const lastCleanUp = ref<{ reference: string; cleanUp: MergeCleanup } | null>(null)
const busy = ref(false)

const shipping = computed(() =>
  (stories.data.value ?? []).filter((story) => SHIPPING_STATES.includes(story.state)),
)

const conflicted = computed(() => (stories.data.value ?? []).filter((story) => story.mergeConflict))

const worktreeOf = computed(
  () => (storyId: number) =>
    (worktrees.data.value ?? []).find((worktree) => worktree.storyId === storyId) ?? null,
)

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
    await Promise.all([stories.reload(), worktrees.reload()])
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function openWorktree(story: KanbanStory): Promise<void> {
  return guard(() =>
    board.send(`/api/stories/${story.id}/worktree`, 'POST', { baseRef: baseRef.value }),
  )
}

function closeWorktree(story: KanbanStory, force: boolean): Promise<void> {
  return guard(() => board.send(`/api/stories/${story.id}/worktree`, 'DELETE', { force }))
}

function rollOut(story: KanbanStory): Promise<void> {
  const percent = percents.value.get(story.id) ?? 0
  return guard(() => board.send(`/api/stories/${story.id}/rollout`, 'POST', { percent }))
}

function markDone(story: KanbanStory): Promise<void> {
  return guard(async () => {
    const answer = await board.send<{ cleanUp: MergeCleanup }>(
      `/api/stories/${story.id}/done`,
      'POST',
    )
    lastCleanUp.value = { reference: story.reference, cleanUp: answer.cleanUp }
  })
}

function clearConflict(story: KanbanStory): Promise<void> {
  return guard(() => board.send(`/api/stories/${story.id}/merge-conflict`, 'DELETE'))
}

function setPercent(storyId: number, value: string): void {
  percents.value = new Map(percents.value).set(storyId, Number(value))
}

onMounted(() => Promise.all([stories.reload(), worktrees.reload()]))
</script>

<template>
  <div class="p-8">
    <div class="flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase"
          >Branche d integration</span
        >
        <input
          v-model="baseRef"
          type="text"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
      </label>
      <p class="ml-auto font-mono text-[11px] text-txt-low">
        {{ (worktrees.data.value ?? []).length }} worktrees ouverts
      </p>
    </div>

    <section v-if="conflicted.length > 0" class="mt-6 rounded-2xl border border-red bg-red-soft/10 p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-red uppercase">Conflits de merge</p>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="story in conflicted" :key="story.id" class="flex items-center gap-3 text-xs">
          <span class="font-mono text-[11px] text-red">{{ story.reference }}</span>
          <span class="text-txt-hi">{{ story.title }}</span>
          <button
            type="button"
            :disabled="busy"
            class="ml-auto rounded-lg border border-line bg-elev px-3 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="clearConflict(story)"
          >
            Conflit resolu
          </button>
        </li>
      </ul>
    </section>

    <p
      v-if="lastCleanUp !== null"
      class="mt-6 rounded-2xl border border-green bg-green-soft/10 p-4 text-xs text-txt-hi"
      role="status"
    >
      {{ lastCleanUp.reference }} est en production. {{ lastCleanUp.cleanUp.scopesReleased }} perimetres
      rendus,
      <template v-if="lastCleanUp.cleanUp.worktreeClosed">worktree retire.</template>
      <template v-else-if="lastCleanUp.cleanUp.worktreeRefusal !== null"
        >worktree conserve : {{ lastCleanUp.cleanUp.worktreeRefusal }}</template
      >
      <template v-else>aucun worktree a retirer.</template>
    </p>

    <div class="mt-6">
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="shipping.length === 0"
        empty-label="Aucune story en cours de livraison."
        @retry="stories.reload()"
      >
        <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
          <article
            v-for="story in shipping"
            :key="story.id"
            class="rounded-2xl border border-line bg-card p-4"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] font-semibold text-acc">{{ story.reference }}</span>
              <span class="ml-auto font-mono text-[10px] text-txt-low uppercase">{{
                STATE_LABELS[story.state]
              }}</span>
            </div>
            <h2 class="display-italic mt-1 text-base">{{ story.title }}</h2>

            <div v-if="worktreeOf(story.id) !== null" class="mt-3 rounded-xl border border-line bg-elev p-3">
              <p class="font-mono text-[11px] text-txt-hi">{{ worktreeOf(story.id)?.branch }}</p>
              <p class="mt-1 font-mono text-[10px] text-txt-low">
                port {{ worktreeOf(story.id)?.port }} ·
                {{ worktreeOf(story.id)?.subdomain }} ·
                depuis {{ worktreeOf(story.id)?.baseSha.slice(0, 8) }}
              </p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  :disabled="busy"
                  class="rounded-lg border border-line bg-card px-2 py-1 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
                  @click="closeWorktree(story, false)"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  :disabled="busy"
                  class="rounded-lg border border-red bg-card px-2 py-1 text-[10px] font-bold text-red uppercase disabled:opacity-40"
                  @click="closeWorktree(story, true)"
                >
                  Fermer de force
                </button>
              </div>
            </div>
            <button
              v-else
              type="button"
              :disabled="busy"
              class="mt-3 w-full rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
              @click="openWorktree(story)"
            >
              Ouvrir sa branche
            </button>

            <div class="mt-4">
              <p class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">
                Feature flag · {{ story.rolloutPercent ?? 0 }} %
              </p>
              <div class="mt-2 h-1.5 rounded bg-elev">
                <div
                  class="h-full rounded bg-acc"
                  :style="{ width: `${story.rolloutPercent ?? 0}%` }"
                />
              </div>
              <div class="mt-3 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="percents.get(story.id) ?? story.rolloutPercent ?? 0"
                  class="flex-1"
                  :aria-label="`Pourcentage de deploiement de ${story.reference}`"
                  @input="setPercent(story.id, ($event.target as HTMLInputElement).value)"
                />
                <button
                  type="button"
                  :disabled="busy"
                  class="rounded-lg border border-line bg-elev px-3 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
                  @click="rollOut(story)"
                >
                  Deployer
                </button>
              </div>
            </div>

            <button
              v-if="story.state !== 'done'"
              type="button"
              :disabled="busy"
              class="mt-4 w-full rounded-lg border border-green bg-green-soft/20 px-3 py-2 text-xs font-bold text-green uppercase disabled:opacity-40"
              @click="markDone(story)"
            >
              En production, debloque la suite
            </button>
          </article>
        </div>
      </ScreenState>
    </div>

    <p v-if="refusal !== null" class="mt-4 text-xs text-red" role="alert">{{ refusal }}</p>
  </div>
</template>
