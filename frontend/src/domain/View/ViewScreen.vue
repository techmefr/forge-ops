<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import PilotPanel from '@/domain/Pilot/PilotPanel.vue'
import type { KanbanStory } from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const stories = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const openStoryId = ref<number | null>(null)
const evidencePath = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const deposited = ref<string | null>(null)

const running = computed(() => stories.data.value ?? [])
const openStory = computed(() => running.value.find((story) => story.id === openStoryId.value) ?? null)

function choose(storyId: number): void {
  openStoryId.value = storyId
  evidencePath.value = ''
  deposited.value = null
  refusal.value = null
}

async function prove(): Promise<void> {
  const storyId = openStoryId.value
  if (storyId === null || evidencePath.value === '') {
    return
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send(`/api/stories/${storyId}/checkpoints`, 'POST', {
      name: 'verified',
      evidencePath: evidencePath.value,
    })
    deposited.value = evidencePath.value
    evidencePath.value = ''
    await stories.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

onMounted(() => stories.reload())
</script>

<template>
  <div class="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
    <section class="min-h-0 overflow-auto border-b border-line p-5 lg:border-r lg:border-b-0">
      <h2 class="display-italic text-sm text-txt-mid">{{ t('view.sessionsToWatch') }}</h2>
      <ScreenState
        :pending="stories.pending.value"
        :failure="stories.failure.value"
        :empty="running.length === 0"
        empty-key="view.empty"
        @retry="stories.reload()"
      >
        <div class="mt-3 flex flex-col gap-2">
          <button
            v-for="story in running"
            :key="story.id"
            type="button"
            class="rounded-xl border bg-card p-3 text-left"
            :class="openStoryId === story.id ? 'border-acc' : 'border-line hover:border-acc'"
            @click="choose(story.id)"
          >
            <span class="font-mono text-[10px] text-acc">{{ story.reference }}</span>
            <span class="mt-1 block text-sm text-txt-hi">{{ story.title }}</span>
            <span class="mt-1 block font-mono text-[10px] text-txt-low uppercase">{{
              t(`state.${story.state}`)
            }}</span>
          </button>
        </div>
      </ScreenState>
    </section>

    <section class="min-w-0 overflow-auto p-6">
      <p v-if="openStoryId === null" class="text-sm text-txt-low">{{ t('view.chooseSession') }}</p>

      <template v-else>
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('view.renderOf', { reference: openStory?.reference ?? '' }) }}
        </p>

        <div class="mt-3">
          <PilotPanel :story-id="openStoryId" @proven="evidencePath = $event.evidencePath" />
        </div>

        <form class="mt-5 rounded-2xl border border-line bg-card p-4" @submit.prevent="prove">
          <p class="display-italic text-sm text-txt-mid">{{ t('view.keepScreenshot') }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <input
              v-model="evidencePath"
              type="text"
              :placeholder="t('view.evidencePlaceholder')"
              class="min-w-[280px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 font-mono text-xs text-txt-hi"
            />
            <button
              type="submit"
              :disabled="busy || evidencePath === ''"
              class="rounded-lg bg-acc px-3 py-2 text-[10px] font-bold text-bg uppercase disabled:opacity-40"
            >
              {{ t('view.dropEvidence') }}
            </button>
          </div>
          <p v-if="deposited !== null" class="mt-2 font-mono text-[10px] text-green">
            {{ t('view.provenBy', { path: deposited }) }}
          </p>
          <p v-if="refusal !== null" class="mt-2 text-xs text-red">{{ say(refusal) }}</p>
        </form>
      </template>
    </section>
  </div>
</template>
