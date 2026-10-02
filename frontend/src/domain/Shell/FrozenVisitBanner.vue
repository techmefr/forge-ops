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
    class="flex flex-none items-center gap-x-2 border-t border-line bg-panel px-2 sm:gap-x-4 sm:px-6"
    :aria-label="t('visit.title')"
  >
    <p class="text-xs font-medium whitespace-nowrap text-txt-mid">
      {{ t('visit.title') }}
    </p>
    <p class="hidden min-w-0 flex-1 truncate text-xs text-txt-low lg:block" :title="t('visit.body')">
      {{ t('visit.body') }}
    </p>
    <div class="ml-auto flex items-center sm:gap-3">
      <a
        :href="REPOSITORY"
        target="_blank"
        rel="noreferrer"
        class="inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 sm:px-2 text-xs text-txt-hi underline underline-offset-2 sm:min-h-9"
      >
        {{ t('visit.source') }}
      </a>
      <button
        type="button"
        class="min-h-11 min-w-11 px-1.5 text-xs whitespace-nowrap text-txt-hi underline underline-offset-2 sm:min-h-9"
        data-test-id="demo-reset"
        @click="resetDemo"
      >
        {{ t('visit.reset') }}
      </button>
      <button
        type="button"
        class="min-h-11 min-w-11 px-1.5 text-xs text-txt-low sm:min-h-9"
        data-test-id="demo-dismiss"
        @click="open = false"
      >
        {{ t('visit.dismiss') }}
      </button>
    </div>
  </aside>
</template>
