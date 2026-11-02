<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { useTranscript } from '@/domain/Session/UseTranscript'

defineProps<{ said: ReturnType<ReturnType<typeof useTranscript>['visible']> }>()

const { t } = useI18n()
</script>

<template>
  <div class="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
    <article
      v-for="(utterance, index) in said"
      :key="index"
      class="rounded-lg p-3"
      :class="utterance.name === 'session.human' ? 'ml-8 bg-elev' : 'mr-8 bg-card'"
    >
      <p class="text-xs text-txt-low">
        {{ utterance.name === 'session.human' ? t('story.you') : t('story.claude') }}
        <span v-if="utterance.phase !== null"> · {{ t(`phase.${utterance.phase}`) }}</span>
      </p>
      <p
        v-if="utterance.text !== null || utterance.textKey !== null"
        class="mt-1.5 text-sm whitespace-pre-wrap text-txt-hi"
      >
        {{ utterance.text ?? t(utterance.textKey ?? '') }}
      </p>
      <p v-if="utterance.costUsd !== null" class="mt-1.5 font-mono text-xs text-acc">
        {{ t('common.money', { amount: utterance.costUsd.toFixed(4) }) }}
      </p>
    </article>
  </div>
</template>
