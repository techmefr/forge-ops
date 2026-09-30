<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resetDemo } from '@/technical/Api/DemoStream'

const REPOSITORY = 'https://github.com/techmefr/forge-ops'

const { t } = useI18n()
const open = ref(true)
</script>

<template>
  <aside
    v-if="open"
    class="fixed right-3 bottom-3 left-3 z-50 flex flex-col gap-2 rounded-[10px] border border-line bg-panel p-3 shadow-lg sm:right-auto sm:max-w-[320px] sm:p-4 lg:left-[262px]"
    :aria-label="t('visit.title')"
  >
    <p class="font-mono text-[10px] font-semibold tracking-[0.22em] text-acc uppercase">
      {{ t('visit.title') }}
    </p>
    <p class="hidden text-[13px] leading-snug text-txt-mid sm:block">{{ t('visit.body') }}</p>
    <div class="flex items-center justify-between gap-3">
      <a
        :href="REPOSITORY"
        target="_blank"
        rel="noreferrer"
        class="inline-flex min-h-11 items-center font-mono text-[11px] text-txt-hi underline underline-offset-2 sm:min-h-6"
      >
        {{ t('visit.source') }}
      </a>
      <button
        type="button"
        class="min-h-11 font-mono text-[11px] tracking-[0.14em] text-txt-hi uppercase underline underline-offset-2 sm:min-h-6"
        data-test-id="demo-reset"
        @click="resetDemo"
      >
        {{ t('visit.reset') }}
      </button>
      <button
        type="button"
        class="min-h-11 font-mono text-[11px] tracking-[0.14em] text-txt-low uppercase sm:min-h-6"
        @click="open = false"
      >
        {{ t('tour.skip') }}
      </button>
    </div>
  </aside>
</template>
