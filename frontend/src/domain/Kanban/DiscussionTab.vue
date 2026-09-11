<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { Discussion, KanbanStory } from '@/domain/Board/BoardModel'
import { saidWhen } from './Moment'

const props = defineProps<{ story: KanbanStory }>()
const emit = defineEmits<{ freed: [] }>()

const { t, d } = useI18n()
const say = usePhrase()

const discussion = useResource<Discussion>(() =>
  board.read(`/api/stories/${props.story.id}/discussion`),
)
const reply = ref('')
const reason = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

function spokenWhen(written: string): string {
  const moment = saidWhen(written, new Date())
  return moment.said === null ? d(moment.date ?? new Date(), 'dayTime') : say(moment.said)
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

function answer(): Promise<void> {
  return guard(async () => {
    const held = discussion.data.value?.hold ?? null
    await board.send(`/api/stories/${props.story.id}/discussion`, 'POST', { body: reply.value })
    reply.value = ''
    await discussion.reload()
    if (held !== null) {
      emit('freed')
    }
  })
}

function hold(): Promise<void> {
  return guard(async () => {
    await board.send(`/api/stories/${props.story.id}/hold`, 'POST', { reason: reason.value })
    reason.value = ''
    await discussion.reload()
  })
}

watch(() => props.story.id, () => void discussion.reload(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="discussion.data.value?.hold"
      class="rounded-2xl border border-orange bg-orange/10 p-4"
      role="alert"
    >
      <p class="font-mono text-[10px] font-bold text-orange uppercase">{{ t('discussion.held') }}</p>
      <p class="mt-1.5 text-sm text-txt-hi">{{ discussion.data.value.hold.reason }}</p>
      <p class="mt-2 font-mono text-[10px] text-txt-low">
        {{ t('discussion.askedBy', { author: discussion.data.value.hold.askedBy }) }}
      </p>
    </div>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>

    <ScreenState
      :pending="discussion.pending.value"
      :failure="discussion.failure.value"
      :empty="(discussion.data.value?.remarks ?? []).length === 0"
      empty-key="discussion.empty"
      @retry="discussion.reload()"
    >
      <div class="flex flex-col gap-2">
        <article
          v-for="remark in discussion.data.value?.remarks ?? []"
          :key="remark.id"
          class="rounded-xl border p-3"
          :class="remark.voice === 'human' ? 'ml-6 border-acc bg-acc-soft/10' : 'mr-6 border-line bg-card'"
        >
          <p class="flex items-center gap-2 font-mono text-[10px] uppercase">
            <span
              class="rounded px-1.5 py-0.5 text-[9px] font-bold"
              :class="remark.voice === 'human' ? 'bg-acc-soft/25 text-acc' : 'bg-elev text-txt-mid'"
              >{{ t(`voice.${remark.voice}`) }}</span
            >
            <span class="text-txt-low">{{ remark.author }}</span>
            <time class="ml-auto text-txt-low" :datetime="remark.writtenAt">{{
              spokenWhen(remark.writtenAt)
            }}</time>
          </p>
          <p class="mt-1.5 text-sm whitespace-pre-wrap text-txt-hi">{{ remark.body }}</p>
        </article>
      </div>
    </ScreenState>

    <form class="flex flex-col gap-2" @submit.prevent="answer">
      <label class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase" for="reply">
        {{ t('discussion.yourReply') }}
      </label>
      <textarea
        id="reply"
        v-model="reply"
        rows="3"
        class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
      ></textarea>
      <button
        type="submit"
        :disabled="busy || reply.trim() === ''"
        class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
      >
        {{ discussion.data.value?.hold ? t('discussion.replyAndUnblock') : t('discussion.reply') }}
      </button>
    </form>

    <form
      v-if="!discussion.data.value?.hold"
      class="flex flex-col gap-2 border-t border-line pt-4"
      @submit.prevent="hold"
    >
      <label class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase" for="reason">
        {{ t('discussion.whatMustBeSettled') }}
      </label>
      <input
        id="reason"
        v-model="reason"
        type="text"
        class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
      />
      <button
        type="submit"
        :disabled="busy || reason.trim() === ''"
        class="rounded-lg border border-orange bg-card px-4 py-2 text-xs font-bold text-orange uppercase disabled:opacity-40"
      >
        {{ t('discussion.holdForRuling') }}
      </button>
    </form>
  </div>
</template>
