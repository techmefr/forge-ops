<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { KanbanColumn, KanbanStory, StoryHold } from '@/domain/Board/BoardModel'
import CardDrawer from './CardDrawer.vue'
import { holdOf } from './Hold'

const { t } = useI18n()

const columns = useResource<readonly KanbanColumn[]>(() => board.read('/api/board/columns'))
const stories = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const holds = useResource<readonly StoryHold[]>(() => board.read('/api/board/holds'))

const heldStory = computed(() => (storyId: number) => holdOf(holds.data.value ?? [], storyId))
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

function reloadBoard(): Promise<unknown> {
  return Promise.all([stories.reload(), holds.reload()])
}

onMounted(() => Promise.all([columns.reload(), reloadBoard()]))
</script>

<template>
  <div class="flex h-full min-w-0">
  <div class="flex min-w-0 flex-1 flex-col p-6">
    <div class="min-h-0 flex-1">
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="(stories.data.value ?? []).length === 0"
        empty-key="kanban.empty"
        @retry="stories.reload()"
      >
        <div class="flex h-full gap-4 overflow-x-auto pb-4" data-tour="kanban-columns">
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
              <h2 class="display-italic text-sm">{{ t(`state.${column.key}`) }}</h2>
              <span class="ml-auto font-mono text-[11px] text-txt-low">{{
                (byColumn.get(column.key) ?? []).length
              }}</span>
            </header>
            <div class="flex flex-col gap-2 overflow-auto p-3">
              <button
                v-for="story in byColumn.get(column.key) ?? []"
                :key="story.id"
                type="button"
                :aria-label="`${story.reference} ${story.title}`"
                data-tour="kanban-card"
                class="w-full rounded-xl border bg-card p-3 text-left hover:border-acc"
                :class="story.mergeConflict ? 'border-red' : 'border-line'"
                @click="drawerId = story.id"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[10px] font-semibold text-acc">{{ story.reference }}</span>
                  <span v-if="story.points !== null" class="ml-auto font-mono text-[10px] text-txt-low">{{
                    t('kanban.points', { count: story.points }, story.points)
                  }}</span>
                </div>
                <span class="mt-1.5 block text-sm text-txt-hi">{{ story.title }}</span>
                <p v-if="story.mergeConflict" class="mt-2 font-mono text-[10px] text-red uppercase">
                  {{ t('kanban.mergeConflict') }}
                </p>
                <p v-if="heldStory(story.id) !== null" class="mt-2 text-[11px] text-orange">
                  <span class="font-mono text-[10px] font-bold uppercase">{{ t('kanban.held') }}</span>
                  · {{ heldStory(story.id)?.reason }}
                </p>
                <p v-if="story.blockers.length > 0" class="mt-2 text-[11px] text-orange">
                  {{ t('kanban.blockedBy') }}
                  <span
                    v-for="blocker in story.blockers"
                    :key="blocker"
                    class="ml-1 font-mono text-[10px]"
                    >{{ blocker }}</span
                  >
                </p>
                <p class="mt-2 font-mono text-[10px] text-txt-low">
                  {{ t('common.money', { amount: story.usage.costUsd.toFixed(2) }) }} ·
                  {{
                    t(
                      'kanban.tokens',
                      { count: story.usage.inputTokens + story.usage.outputTokens },
                      story.usage.inputTokens + story.usage.outputTokens,
                    )
                  }}
                </p>
              </button>
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
      @moved="reloadBoard()"
    />
  </div>
</template>
