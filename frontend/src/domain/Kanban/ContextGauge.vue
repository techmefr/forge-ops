<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SessionContext } from '@/domain/Board/BoardModel'
import { contextGaugeOf, contextGaugeColour } from '@/domain/Agent/ContextGauge'

const props = defineProps<{ context: SessionContext | null }>()

const { t } = useI18n()
const gauge = computed(() => contextGaugeOf(props.context))
</script>

<template>
  <div
    v-if="gauge !== null"
    class="flex items-center gap-2"
    role="group"
    :aria-label="t('contextGauge.aria')"
  >
    <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">{{
      t('contextGauge.title')
    }}</span>
    <span class="h-1 w-16 flex-none overflow-hidden rounded-full bg-elev">
      <span
        class="block h-full rounded-full"
        :class="contextGaugeColour(gauge.percent)"
        :style="{ width: `${Math.min(gauge.percent ?? 100, 100)}%` }"
      />
    </span>
    <span class="font-mono text-[10px] whitespace-nowrap text-txt-mid">{{
      gauge.window !== null
        ? t('contextGauge.known', { tokens: gauge.tokens, window: gauge.window, percent: gauge.percent })
        : t('contextGauge.unknown', { tokens: gauge.tokens })
    }}</span>
  </div>
</template>
