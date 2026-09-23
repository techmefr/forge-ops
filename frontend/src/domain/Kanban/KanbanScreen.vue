<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { ColumnTemplate, KanbanColumn, ProjectCard, StoryHold } from '@/domain/Board/BoardModel'
import { tintOf } from '@/technical/Ui/Tint'
import CardDrawer from './CardDrawer.vue'
import ColumnPanel from '@/domain/Template/ColumnPanel.vue'
import { holdOf } from './Hold'

const { t } = useI18n()
const say = usePhrase()

const columns = useResource<readonly KanbanColumn[]>(() => board.read('/api/board/columns'))
const stories = useResource<readonly ProjectCard[]>(() => board.read('/api/board/projects'))
const holds = useResource<readonly StoryHold[]>(() => board.read('/api/board/holds'))
const templates = useResource<{ defaultTemplate: ColumnTemplate; maySettle: boolean }>(() =>
  board.read('/api/templates'),
)
const settled = ref<string | null>(null)

const heldStory = computed(() => (storyId: number) => holdOf(holds.data.value ?? [], storyId))
const drawerId = ref<number | null>(null)
const chosen = ref<Set<number>>(new Set())
const refusals = ref<readonly string[]>([])
const busy = ref(false)

function toggle(storyId: number): void {
  const next = new Set(chosen.value)
  if (next.has(storyId)) {
    next.delete(storyId)
  } else {
    next.add(storyId)
  }
  chosen.value = next
}

async function sendToArchitecture(): Promise<void> {
  busy.value = true
  refusals.value = []
  for (const storyId of chosen.value) {
    try {
      await board.send(`/api/stories/${storyId}/dispatch`, 'POST', { phase: 'architecture' })
    } catch (error) {
      refusals.value = [
        ...refusals.value,
        t('backlog.refusalOn', { id: storyId, reason: say(reasonOf(error)) }),
      ]
    }
  }
  chosen.value = new Set()
  busy.value = false
  await reloadBoard()
}

const openStory = computed(
  () => (stories.data.value ?? []).find((story) => story.id === drawerId.value) ?? null,
)

function lateness(story: ProjectCard): string {
  return story.daysLeft !== null && story.daysLeft < 0 ? 'text-orange' : 'text-txt-low'
}

function blockedReasonOf(story: ProjectCard): string | null {
  return story.blockedReason ?? heldStory.value(story.id)?.reason ?? null
}

const byColumn = computed(() => {
  const grouped = new Map<string, ProjectCard[]>()
  for (const story of stories.data.value ?? []) {
    grouped.set(story.state, [...(grouped.get(story.state) ?? []), story])
  }
  return grouped
})

function reloadBoard(): Promise<unknown> {
  return Promise.all([stories.reload(), holds.reload()])
}

async function reloadTemplate(): Promise<void> {
  await Promise.all([templates.reload(), columns.reload()])
}

onMounted(() => Promise.all([columns.reload(), templates.reload(), reloadBoard()]))
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
            class="flex w-[280px] flex-none flex-col rounded-lg border border-line bg-panel"
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
              <button
                type="button"
                class="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-txt-low uppercase hover:border-acc hover:text-txt-hi"
                :aria-expanded="settled === column.key"
                :aria-label="t('template.openPanel', { column: column.label })"
                @click="settled = settled === column.key ? null : column.key"
              >
                {{ t('template.settings') }}
              </button>
            </header>

            <ColumnPanel
              v-if="settled === column.key"
              :template="templates.data.value?.defaultTemplate ?? null"
              :stage="column.key"
              :may-settle="templates.data.value?.maySettle ?? false"
              @close="settled = null"
              @written="reloadTemplate()"
            />
            <div
              v-if="column.key === 'backlog'"
              class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5"
            >
              <span class="font-mono text-[11px] text-txt-low uppercase">{{
                t('backlog.chosenCount', { count: chosen.size }, chosen.size)
              }}</span>
              <button
                type="button"
                :disabled="busy || chosen.size === 0"
                class="ml-auto rounded-lg border border-acc bg-acc px-4 py-2.5 font-mono text-[11px] font-bold text-ink uppercase disabled:opacity-40"
                @click="sendToArchitecture()"
              >
                {{ t('backlog.sendToArchitecture') }}
              </button>
              <ul v-if="refusals.length > 0" class="flex w-full flex-col gap-1" role="alert">
                <li v-for="refusal in refusals" :key="refusal" class="text-[11px] text-red">
                  {{ refusal }}
                </li>
              </ul>
            </div>

            <div class="flex flex-col gap-3 overflow-auto p-3">
              <button
                v-for="story in byColumn.get(column.key) ?? []"
                :key="story.id"
                type="button"
                :aria-label="`${story.projectSlug} ${story.reference} ${story.title}`"
                data-tour="kanban-card"
                class="w-full rounded-lg border bg-card p-4 text-left hover:border-acc"
                :class="story.attention === null ? 'border-transparent' : 'border-orange'"
                @click="drawerId = story.id"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold text-deep"
                    :style="{ background: tintOf(story.projectColour) }"
                    >{{ story.projectSlug }}</span
                  >
                  <span class="font-mono text-[11px] font-semibold text-txt-mid">{{ story.reference }}</span>
                  <label
                    v-if="column.key === 'backlog'"
                    class="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-txt-low uppercase hover:bg-elev hover:text-txt-hi"
                    @click.stop
                  >
                    <input
                      type="checkbox"
                      class="h-[16px] w-[16px] accent-acc"
                      :checked="chosen.has(story.id)"
                      :aria-label="t('backlog.takeOne', { reference: story.reference })"
                      @change="toggle(story.id)"
                    />
                    {{ t('common.take') }}
                  </label>
                  <span
                    v-if="story.attention !== null"
                    class="rounded-md border border-orange px-2.5 py-1.5 font-mono text-[11px] text-orange uppercase"
                    >{{ t(`attention.${story.attention}`) }}</span
                  >
                </div>
                <span class="mt-1.5 block text-sm text-txt-hi">{{ story.title }}</span>
                <span
                  v-if="blockedReasonOf(story) !== null"
                  class="mt-1.5 block truncate text-[11px] text-orange"
                  >{{ blockedReasonOf(story) }}</span
                >
                <p class="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-txt-low">
                  <span>{{ story.holder ?? t('kanban.nobody') }}</span>
                  <span>{{ t('common.money', { amount: story.usage.costUsd.toFixed(2) }) }}</span>
                  <span v-if="story.milestone !== null" class="ml-auto" :class="lateness(story)">
                    {{ t(`milestone.${story.milestone.kind}`) }} {{ story.milestone.dueOn }}
                    <span v-if="story.daysLeft !== null">{{
                      story.daysLeft < 0
                        ? t('kanban.daysLate', { count: -story.daysLeft }, -story.daysLeft)
                        : t('kanban.daysLeft', { count: story.daysLeft }, story.daysLeft)
                    }}</span>
                  </span>
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
      :hold="heldStory(openStory.id)"
      @close="drawerId = null"
      @moved="reloadBoard()"
    />
  </div>
</template>
