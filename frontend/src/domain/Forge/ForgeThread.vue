<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { groupThread } from './ConversationRule'

const props = defineProps<{
  blocks: ReturnType<typeof groupThread>['blocks']
  pending: boolean
  working: boolean
  scrollKey: number
}>()

const { t } = useI18n()

const thread = ref<HTMLElement | null>(null)

function outcomeLabel(outcome: 'started' | 'ok' | 'failed'): string {
  if (outcome === 'ok') {
    return t('forge.drawer.toolOk')
  }
  return outcome === 'failed' ? t('forge.drawer.toolFailed') : t('forge.drawer.toolStarted')
}

const OUTCOME_GLYPH: Readonly<Record<'started' | 'ok' | 'failed', string>> = {
  started: '…',
  ok: '✓',
  failed: '✗',
}

watch(
  () => props.scrollKey,
  async () => {
    await nextTick()
    if (thread.value !== null) {
      thread.value.scrollTop = thread.value.scrollHeight
    }
  },
)
</script>

<template>
  <div
    ref="thread"
    class="min-h-0 flex-1 overflow-y-auto px-5 py-3"
    role="log"
    aria-live="off"
    :aria-label="t('forge.drawer.threadAria')"
    tabindex="0"
  >
    <p
      v-if="blocks.length === 0 && !pending"
      class="m-0 text-xs text-txt-low"
    >
      {{ t('forge.drawer.empty') }}
    </p>
    <ol class="m-0 flex list-none flex-col gap-3 p-0">
      <li v-for="item in blocks" :key="item.id">
        <p
          v-if="item.kind === 'marker'"
          class="m-0 flex items-center gap-2 border-t border-hair pt-2 tabular-nums text-xs text-txt-low"
        >
          <span>{{ t(`phase.${item.phase}`) }}</span>
          <span v-if="item.agent !== null">{{ item.agent }}</span>
        </p>
        <div
          v-else-if="item.kind === 'group'"
          class="flex flex-col gap-0.5"
          :class="item.voice === 'human' ? 'items-end' : 'items-start'"
        >
          <p class="m-0 text-xs text-txt-low">
            {{ item.voice === 'human' && item.author === 'you' ? t('forge.drawer.you') : item.author }}
          </p>
          <div
            class="flex max-w-[92%] flex-col gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-txt-hi"
            :class="item.voice === 'human' ? 'bg-elev' : 'bg-card'"
          >
            <p v-for="message in item.messages" :key="message.id" class="m-0">{{ message.body }}</p>
          </div>
        </div>
        <p
          v-else-if="item.kind === 'tool'"
          class="m-0 flex items-center gap-2 font-mono text-xs"
          :class="item.outcome === 'failed' ? 'text-red' : 'text-txt-mid'"
          data-test="forge-tool"
        >
          <span aria-hidden="true">{{ OUTCOME_GLYPH[item.outcome] }}</span>
          <span>{{ t('forge.drawer.tool', { name: item.name === '' ? '·' : item.name }) }}</span>
          <span class="text-txt-low">{{ outcomeLabel(item.outcome) }}</span>
        </p>
        <p v-else class="m-0 text-xs text-red" role="alert">{{ item.text }}</p>
      </li>
    </ol>
    <p
      v-if="working"
      class="m-0 mt-2 flex items-center gap-2 text-xs text-acc"
      data-test="forge-working"
    >
      <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-acc motion-reduce:animate-none" aria-hidden="true" />
      {{ t('forge.drawer.working') }}
    </p>
  </div>
</template>
