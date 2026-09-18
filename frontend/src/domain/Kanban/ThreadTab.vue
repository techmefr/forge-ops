<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { KanbanStory } from '@/domain/Board/BoardModel'
import type { StoryThread } from '@contract/ConversationContract'
import { saidWhen } from './Moment'

const props = defineProps<{ story: KanbanStory }>()
const emit = defineEmits<{ moved: [] }>()

const { t, d } = useI18n()
const say = usePhrase()

const thread = useResource<StoryThread>(() => board.read(`/api/stories/${props.story.id}/thread`))
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

function spokenWhen(written: string): string {
  const moment = saidWhen(written, new Date())
  return moment.said === null ? d(moment.date ?? new Date(), 'dayTime') : say(moment.said)
}

async function validate(): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await board.send(`/api/stories/${props.story.id}/validate`, 'POST', {})
    await thread.reload()
    emit('moved')
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

watch(() => props.story.id, () => void thread.reload(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>

    <ScreenState
      :pending="thread.pending.value"
      :failure="thread.failure.value"
      :empty="(thread.data.value?.chapters ?? []).length === 0"
      empty-key="thread.empty"
      @retry="thread.reload()"
    >
      <div class="flex flex-col gap-3">
        <details
          v-for="(chapter, index) in thread.data.value?.chapters ?? []"
          :key="`${chapter.claudeSessionId ?? 'opening'}-${index}`"
          class="rounded-2xl border border-line bg-card"
          :open="!chapter.collapsed"
        >
          <summary class="cursor-pointer px-4 py-2.5 font-mono text-[10px] text-txt-mid uppercase">
            {{ t(`phase.${chapter.phase}`) }}
            <span v-if="chapter.agentName !== null" class="ml-2 text-txt-low">{{
              chapter.agentName
            }}</span>
            <span class="ml-2 text-txt-low">{{
              t('thread.entries', { count: chapter.entries.length }, chapter.entries.length)
            }}</span>
          </summary>
          <div class="flex flex-col gap-2 px-4 pb-4">
            <article
              v-for="(entry, position) in chapter.entries"
              :key="`${entry.at}-${position}`"
              class="rounded-xl border p-3"
              :class="
                entry.kind === 'proof' ? 'border-green bg-green/10' : 'border-line bg-panel'
              "
            >
              <p class="flex items-center gap-2 font-mono text-[10px] uppercase">
                <span
                  class="rounded px-1.5 py-0.5 text-[9px] font-bold"
                  :class="entry.kind === 'proof' ? 'bg-green/25 text-green' : 'bg-elev text-txt-mid'"
                  >{{ t(`threadEntry.${entry.kind}`) }}</span
                >
                <span class="text-txt-low">{{ entry.author }}</span>
                <time class="ml-auto text-txt-low" :datetime="entry.at">{{
                  spokenWhen(entry.at)
                }}</time>
              </p>
              <p class="mt-1.5 text-sm whitespace-pre-wrap text-txt-hi">{{ entry.body }}</p>
              <p v-if="entry.evidencePath !== null" class="mt-1 font-mono text-[10px] text-txt-low">
                {{ entry.evidencePath }}
              </p>
            </article>
          </div>
        </details>
      </div>
    </ScreenState>

    <section
      v-if="thread.data.value?.awaitsValidation"
      class="rounded-2xl border border-acc bg-acc-soft/10 p-4"
    >
      <p class="font-mono text-[10px] font-bold text-acc uppercase">{{ t('thread.awaiting') }}</p>
      <p class="mt-1.5 text-sm text-txt-hi">{{ t('thread.awaitingSaid') }}</p>
      <pre
        v-if="thread.data.value.opening !== null"
        class="mt-2 max-h-40 overflow-auto rounded-lg border border-line bg-panel p-3 text-[11px] whitespace-pre-wrap text-txt-mid"
        >{{ thread.data.value.opening.prompt }}</pre
      >
      <button
        type="button"
        :disabled="busy"
        class="mt-3 rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        @click="validate"
      >
        {{ t('thread.validate') }}
      </button>
    </section>
  </div>
</template>
