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
  <p v-if="pending" class="text-xs text-txt-low">
    {{ t('common.loading') }}
  </p>
  <div
    v-else-if="failure !== null"
    class="rounded-2xl bg-red-soft/10 p-5"
    role="alert"
  >
    <p class="text-xs text-red">
      {{ t('common.boardRefused') }}
    </p>
    <p class="mt-2 text-sm text-txt-hi">{{ say(failure) }}</p>
    <button
      type="button"
      class="mt-4 rounded-lg bg-card px-3 py-2 text-xs font-semibold text-txt-mid hover:bg-elev"
      @click="emit('retry')"
    >
      {{ t('common.retry') }}
    </button>
  </div>
  <p v-else-if="empty" class="text-sm text-txt-low">{{ t(emptyKey) }}</p>
  <slot v-else />
</template>
