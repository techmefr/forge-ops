<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const REPOSITORY = 'https://github.com/techmefr/forge-ops'

const { t } = useI18n()
const open = ref(true)
</script>

<template>
  <aside
    v-if="open"
    class="fixed bottom-3 left-3 z-50 flex max-w-[320px] flex-col gap-2 rounded-[10px] border border-line bg-panel p-4 shadow-lg lg:left-[262px]"
    :aria-label="t('visit.title')"
  >
    <p class="font-mono text-[10px] font-semibold tracking-[0.22em] text-acc uppercase">
      {{ t('visit.title') }}
    </p>
    <p class="text-[13px] leading-snug text-txt-mid">{{ t('visit.body') }}</p>
    <div class="flex items-center justify-between gap-3">
      <a
        :href="REPOSITORY"
        target="_blank"
        rel="noreferrer"
        class="font-mono text-[11px] text-txt-hi underline underline-offset-2"
      >
        {{ t('visit.source') }}
      </a>
      <button
        type="button"
        class="font-mono text-[11px] tracking-[0.14em] text-txt-low uppercase"
        @click="open = false"
      >
        {{ t('tour.skip') }}
      </button>
    </div>
  </aside>
</template>
