<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ shown: boolean; wide: boolean }>()

const emit = defineEmits<{ toggleShown: []; toggleWide: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 border-b border-line px-4 py-2">
    <div class="min-w-0 flex-1"><slot /></div>
    <button
      type="button"
      class="min-h-[24px] min-w-[24px] rounded border border-line px-1.5 font-mono text-[10px] text-txt-low hover:border-acc hover:text-acc"
      :aria-label="wide ? t('browser.shrink') : t('browser.widen')"
      :aria-pressed="wide"
      @click="emit('toggleWide')"
    >
      {{ wide ? '><' : '<>' }}
    </button>
    <button
      type="button"
      class="min-h-[24px] min-w-[24px] rounded border border-line px-1.5 font-mono text-[10px] text-txt-low hover:border-acc hover:text-acc"
      :aria-label="shown ? t('browser.collapse') : t('browser.expand')"
      :aria-expanded="shown"
      @click="emit('toggleShown')"
    >
      {{ shown ? '–' : '+' }}
    </button>
  </div>
</template>
