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
  <div v-if="pending" class="flex flex-col gap-3" role="status" data-test-id="screen-loading">
    <span class="h-4 w-1/3 animate-pulse rounded-sm bg-elev" aria-hidden="true" />
    <span class="h-16 w-full animate-pulse rounded-md bg-elev" aria-hidden="true" />
    <span class="h-16 w-full animate-pulse rounded-md bg-elev" aria-hidden="true" />
    <span class="text-xs text-txt-mid">{{ t('common.loading') }}</span>
  </div>
  <div
    v-else-if="failure !== null"
    class="card border-red p-6"
    role="alert"
  >
    <p class="text-xs text-red">
      {{ t('common.boardRefused') }}
    </p>
    <p class="mt-2 text-sm text-txt-hi">{{ say(failure) }}</p>
    <button
      type="button"
      class="btn btn-secondary btn-sm mt-4"
      @click="emit('retry')"
    >
      {{ t('common.retry') }}
    </button>
  </div>
  <p
    v-else-if="empty"
    class="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-txt-mid"
    data-test-id="screen-empty"
  >
    {{ t(emptyKey) }}
  </p>
  <slot v-else />
</template>
