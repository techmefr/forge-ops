<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { logLinesOf } from './ConversationRule'

defineProps<{
  lines: ReturnType<typeof logLinesOf>
  canQuote: boolean
}>()

const emit = defineEmits<{ quote: [text: string] }>()

const { t } = useI18n()

const logsPane = ref<HTMLElement | null>(null)
const selected = ref('')

function readSelection(): void {
  const selection = window.getSelection()
  const inside =
    selection !== null && logsPane.value !== null && selection.anchorNode !== null && logsPane.value.contains(selection.anchorNode)
  if (inside) {
    selected.value = selection.toString()
  }
}

function pasteSelection(): void {
  emit('quote', selected.value)
  selected.value = ''
  window.getSelection()?.removeAllRanges()
}

onMounted(() => document.addEventListener('selectionchange', readSelection))
onBeforeUnmount(() => document.removeEventListener('selectionchange', readSelection))
</script>

<template>
  <div
    ref="logsPane"
    class="min-h-0 flex-1 overflow-y-auto px-5 py-3"
    role="tabpanel"
    tabindex="0"
    data-test="forge-logs"
  >
    <p v-if="lines.length === 0" class="m-0 text-xs text-txt-low">{{ t('forge.drawer.logsEmpty') }}</p>
    <ol class="m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs select-text">
      <li
        v-for="line in lines"
        :key="line.id"
        class="whitespace-pre-wrap"
        :class="{
          'mt-2 border-t border-hair pt-2 font-bold text-acc': line.tone === 'phase',
          'text-txt-hi': line.tone === 'agent',
          'text-info': line.tone === 'human',
          'text-txt-low': line.tone === 'tool' || line.tone === 'notice',
          'text-red': line.tone === 'failed',
        }"
      >{{ line.text }}<pre
          v-if="line.detail !== ''"
          class="m-0 mt-1 max-h-64 overflow-auto rounded-md bg-elev p-2 font-mono text-xs whitespace-pre-wrap text-txt-mid"
          data-test="forge-log-detail"
        >{{ line.detail }}</pre></li>
    </ol>
  </div>

  <div v-if="canQuote" class="flex flex-none items-center gap-3 border-t border-hair px-5 py-3">
    <button
      type="button"
      class="btn btn-primary btn-sm"
      :disabled="selected.trim() === ''"
      data-test="forge-paste-selection"
      @mousedown.prevent
      @click="pasteSelection"
    >
      {{ t('forge.drawer.pasteSelection') }}
    </button>
    <span class="text-xs text-txt-low">{{
      selected.trim() === '' ? t('forge.drawer.pasteHint') : t('forge.drawer.pasteReady', { count: selected.trim().length })
    }}</span>
  </div>
</template>
