<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { Epic, Project, Story } from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const stories = useResource<readonly Story[]>(() => board.read('/api/stories/backlog'))
const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const epics = ref<Map<number, Epic>>(new Map())
const chosen = ref<Set<number>>(new Set())
const refusals = ref<readonly string[]>([])
const busy = ref(false)

const count = computed(() => (stories.data.value ?? []).length)

const colourOf = computed(() => (story: Story) => {
  const epic = epics.value.get(story.epicId)
  const project = (projects.data.value ?? []).find((candidate) => candidate.id === epic?.projectId)
  return project?.colour ?? 'var(--forge-line)'
})

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
  await stories.reload()
}

async function loadEpics(): Promise<void> {
  const found = new Map<number, Epic>()
  for (const project of projects.data.value ?? []) {
    const list = await board.read<readonly Epic[]>(`/api/projects/${project.id}/epics`)
    for (const epic of list) {
      found.set(epic.id, epic)
    }
  }
  epics.value = found
}

onMounted(async () => {
  await Promise.all([stories.reload(), projects.reload()])
  await loadEpics()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-8">
    <div class="flex flex-none flex-wrap items-center gap-3">
      <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('backlog.storyCount', { count }, count) }} ·
        {{ t('backlog.chosenCount', { count: chosen.size }, chosen.size) }}
      </p>
      <button
        type="button"
        :disabled="busy || chosen.size === 0"
        class="ml-auto rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        @click="sendToArchitecture()"
      >
        {{ t('backlog.sendToArchitecture') }}
      </button>
    </div>

    <ul v-if="refusals.length > 0" class="mt-4 flex flex-col gap-1" role="alert">
      <li v-for="refusal in refusals" :key="refusal" class="text-xs text-red">{{ refusal }}</li>
    </ul>

    <div class="mt-6 min-h-0 flex-1 overflow-auto pr-1">
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="count === 0"
        empty-key="backlog.empty"
        @retry="stories.reload()"
      >
        <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          <article
            v-for="story in stories.data.value ?? []"
            :key="story.id"
            class="rounded-2xl border bg-card p-4 transition-colors"
            :class="chosen.has(story.id) ? 'border-acc' : 'border-line'"
          >
            <div class="flex items-center gap-2">
              <span
                class="h-3 w-3 flex-none rounded-full"
                :style="{ background: colourOf(story) }"
                aria-hidden="true"
              />
              <span class="font-mono text-[11px] font-semibold text-acc">{{ story.reference }}</span>
              <label
                class="ml-auto flex min-h-[32px] cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] text-txt-low uppercase hover:bg-elev hover:text-txt-hi"
              >
                <input
                  type="checkbox"
                  class="h-[18px] w-[18px] accent-acc"
                  :checked="chosen.has(story.id)"
                  :aria-label="t('backlog.takeOne', { reference: story.reference })"
                  @change="toggle(story.id)"
                />
                {{ t('common.take') }}
              </label>
            </div>
            <button type="button" class="mt-2 block w-full text-left" @click="toggle(story.id)">
              <h2 class="display-italic text-base">{{ story.title }}</h2>
              <p class="mt-2 line-clamp-3 text-xs text-txt-mid">{{ story.body }}</p>
            </button>
            <div class="mt-3 flex items-center gap-3">
              <span class="font-mono text-[10px] text-txt-low">{{
                epics.get(story.epicId)?.title ?? t('backlog.unknownEpic')
              }}</span>
              <RouterLink
                :to="`/me/stories/${story.id}`"
                class="ml-auto font-mono text-[10px] text-acc uppercase hover:underline"
                >{{ t('common.open') }}</RouterLink
              >
            </div>
          </article>
        </div>
      </ScreenState>
    </div>
  </div>
</template>
