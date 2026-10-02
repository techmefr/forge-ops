<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Tooltip from '@/technical/Ui/Tooltip.vue'

defineProps<{ shown: boolean; wide: boolean }>()

const emit = defineEmits<{ toggleShown: []; toggleWide: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 border-b border-hair px-4 py-2">
    <div class="min-w-0 flex-1"><slot /></div>
    <Tooltip :label="wide ? t('browser.shrink') : t('browser.widen')">
      <button
        type="button"
        class="min-h-[24px] min-w-[24px] max-sm:min-h-10 max-sm:min-w-10 rounded px-1.5 text-xs text-txt-low hover:bg-elev hover:text-acc"
        :aria-label="wide ? t('browser.shrink') : t('browser.widen')"
        :aria-pressed="wide"
        @click="emit('toggleWide')"
      >
        {{ wide ? '><' : '<>' }}
      </button>
    </Tooltip>
    <Tooltip :label="shown ? t('browser.collapse') : t('browser.expand')">
      <button
        type="button"
        class="min-h-[24px] min-w-[24px] max-sm:min-h-10 max-sm:min-w-10 rounded px-1.5 text-xs text-txt-low hover:bg-elev hover:text-acc"
        :aria-label="shown ? t('browser.collapse') : t('browser.expand')"
        :aria-expanded="shown"
        @click="emit('toggleShown')"
      >
        {{ shown ? '–' : '+' }}
      </button>
    </Tooltip>
  </div>
</template>
