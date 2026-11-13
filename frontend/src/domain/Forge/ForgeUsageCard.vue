<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import { minutesOf } from './ForgeRule'
import { usageOf } from './ForgeUsage'

const { card } = defineProps<{ card: ForgeCardView }>()

const { t, locale } = useI18n()

const usage = computed(() => usageOf(card))

const figures = computed(() => {
  const compact = new Intl.NumberFormat(locale.value, { notation: 'compact', maximumFractionDigits: 1 })
  return {
    cost: t('forge.money', { amount: card.costUsd.toFixed(2) }),
    time: t('forge.minutes', { count: minutesOf(card.durationSeconds) }),
    tokens: compact.format(usage.value.totalTokens),
    input: compact.format(usage.value.inputTokens),
    output: compact.format(usage.value.outputTokens),
  }
})
</script>

<template>
  <section
    v-if="usage.used"
    class="card mx-6 my-4 flex-none p-4"
    :aria-label="t('forge.usage.title')"
    data-test="forge-usage"
  >
    <dl class="m-0 grid grid-cols-3 gap-4">
      <div>
        <dt class="text-xs text-txt-mid">{{ t('forge.usage.cost') }}</dt>
        <dd class="m-0 text-lg font-semibold tabular-nums text-txt-hi" data-test="forge-usage-cost">{{ figures.cost }}</dd>
      </div>
      <div>
        <dt class="text-xs text-txt-mid">{{ t('forge.usage.tokens') }}</dt>
        <dd class="m-0 text-lg font-semibold tabular-nums text-txt-hi" data-test="forge-usage-tokens">{{ figures.tokens }}</dd>
        <dd class="m-0 text-xs tabular-nums text-txt-mid" data-test="forge-usage-split">
          {{ t('forge.usage.input') }} {{ figures.input }} · {{ t('forge.usage.output') }} {{ figures.output }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-txt-mid">{{ t('forge.usage.time') }}</dt>
        <dd class="m-0 text-lg font-semibold tabular-nums text-txt-hi" data-test="forge-usage-time">{{ figures.time }}</dd>
      </div>
    </dl>
  </section>
</template>
