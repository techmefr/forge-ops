<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePhrase } from '../Language/UsePhrase'
import type { Phrase } from '../Language/Phrase'

const { pending, failure, empty, emptyKey } = defineProps<{
  pending: boolean
  failure: Phrase | null
  empty: boolean
  emptyKey: string
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const say = usePhrase()
</script>

<template>
  <p v-if="pending" class="font-mono text-xs tracking-[0.2em] text-txt-low uppercase">
    {{ t('common.loading') }}
  </p>
  <div
    v-else-if="failure !== null"
    class="rounded-2xl border border-red bg-red-soft/10 p-5"
    role="alert"
  >
    <p class="font-mono text-[11px] tracking-[0.18em] text-red uppercase">
      {{ t('common.boardRefused') }}
    </p>
    <p class="mt-2 text-sm text-txt-hi">{{ say(failure) }}</p>
    <button
      type="button"
      class="mt-4 rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold text-txt-mid uppercase hover:border-acc"
      @click="emit('retry')"
    >
      {{ t('common.retry') }}
    </button>
  </div>
  <p v-else-if="empty" class="text-sm text-txt-low">{{ t(emptyKey) }}</p>
  <slot v-else />
</template>
