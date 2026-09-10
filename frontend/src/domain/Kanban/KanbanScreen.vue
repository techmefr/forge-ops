<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { KanbanColumn, KanbanStory } from '@/domain/Board/BoardModel'
import CardDrawer from './CardDrawer.vue'

const columns = useResource<readonly KanbanColumn[]>(() => board.read('/api/board/columns'))
const stories = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const refusal = ref<string | null>(null)
const blockedStoryId = ref<number | null>(null)
const blockingStoryId = ref<number | null>(null)
const busy = ref(false)
const drawerId = ref<number | null>(null)

const openStory = computed(
  () => (stories.data.value ?? []).find((story) => story.id === drawerId.value) ?? null,
)

const byColumn = computed(() => {
  const grouped = new Map<string, KanbanStory[]>()
  for (const story of stories.data.value ?? []) {
    grouped.set(story.state, [...(grouped.get(story.state) ?? []), story])
  }
  return grouped
})

async function declareDependency(): Promise<void> {
  const blocked = blockedStoryId.value
  const blocking = blockingStoryId.value
  if (blocked === null || blocking === null) {
    refusal.value = 'Choisis la story bloquee et celle qui la bloque'
    return
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send(`/api/stories/${blocked}/dependencies`, 'POST', { blockingStoryId: blocking })
    blockedStoryId.value = null
    blockingStoryId.value = null
    await stories.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

onMounted(() => Promise.all([columns.reload(), stories.reload()]))
</script>

<template>
  <div class="flex h-full min-w-0">
  <div class="flex min-w-0 flex-1 flex-col p-6">
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="declareDependency">
      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Story bloquee</span>
        <select
          v-model="blockedStoryId"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        >
          <option :value="null">A choisir</option>
          <option v-for="story in stories.data.value ?? []" :key="story.id" :value="story.id">
            {{ story.reference }} · {{ story.title }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Bloquee par</span>
        <select
          v-model="blockingStoryId"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        >
          <option :value="null">A choisir</option>
          <option v-for="story in stories.data.value ?? []" :key="story.id" :value="story.id">
            {{ story.reference }} · {{ story.title }}
          </option>
        </select>
      </label>
      <button
        type="submit"
        :disabled="busy"
        class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
      >
        Lier
      </button>
      <RouterLink
        to="/story"
        class="ml-auto rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase"
        >Ajouter une story</RouterLink
      >
    </form>

    <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ refusal }}</p>

    <div class="mt-6 min-h-0 flex-1">
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="(stories.data.value ?? []).length === 0"
        empty-label="Aucune story en cours."
        @retry="stories.reload()"
      >
        <div class="flex h-full gap-4 overflow-x-auto pb-4">
          <section
            v-for="column in columns.data.value ?? []"
            :key="column.key"
            class="flex w-[280px] flex-none flex-col rounded-2xl border border-line bg-panel"
          >
            <header class="flex items-center gap-2 border-b border-line px-4 py-3">
              <span
                class="h-2 w-2 rounded-full"
                :style="{ background: `var(--forge-${column.colour})` }"
                aria-hidden="true"
              />
              <h2 class="display-italic text-sm">{{ column.label }}</h2>
              <span class="ml-auto font-mono text-[11px] text-txt-low">{{
                (byColumn.get(column.key) ?? []).length
              }}</span>
            </header>
            <div class="flex flex-col gap-2 overflow-auto p-3">
              <article
                v-for="story in byColumn.get(column.key) ?? []"
                :key="story.id"
                class="rounded-xl border bg-card p-3"
                :class="story.mergeConflict ? 'border-red' : 'border-line'"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[10px] font-semibold text-acc">{{ story.reference }}</span>
                  <span v-if="story.points !== null" class="ml-auto font-mono text-[10px] text-txt-low"
                    >{{ story.points }} pts</span
                  >
                </div>
                <button
                  type="button"
                  class="mt-1.5 block w-full text-left text-sm text-txt-hi hover:text-acc"
                  @click="drawerId = story.id"
                >
                  {{ story.title }}
                </button>
                <p v-if="story.mergeConflict" class="mt-2 font-mono text-[10px] text-red uppercase">
                  Conflit de merge
                </p>
                <p v-if="story.blockers.length > 0" class="mt-2 text-[11px] text-orange">
                  Bloquee par
                  <span
                    v-for="blocker in story.blockers"
                    :key="blocker"
                    class="ml-1 font-mono text-[10px]"
                    >{{ blocker }}</span
                  >
                </p>
                <p class="mt-2 font-mono text-[10px] text-txt-low">
                  {{ story.usage.costUsd.toFixed(2) }} $ ·
                  {{ story.usage.inputTokens + story.usage.outputTokens }} jetons
                </p>
              </article>
            </div>
          </section>
        </div>
      </ScreenState>
    </div>
  </div>

    <CardDrawer
      v-if="openStory !== null"
      :story="openStory"
      @close="drawerId = null"
      @moved="stories.reload()"
    />
  </div>
</template>
