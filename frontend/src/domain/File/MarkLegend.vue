<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MARK_TONES, SPOKEN_MARKS } from './FileMarkTone'

const { t } = useI18n()
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-3 gap-y-1.5" :aria-label="t('browser.legend')">
    <li v-for="mark in SPOKEN_MARKS" :key="mark" class="flex items-center gap-1.5">
      <span class="h-2 w-2 flex-none rounded-full" :class="MARK_TONES[mark].dot" aria-hidden="true" />
      <span class="text-[11px] whitespace-nowrap" :class="MARK_TONES[mark].text">{{
        t(`mark.${mark}`)
      }}</span>
    </li>
  </ul>
</template>
