<script setup lang="ts">
import { computed } from 'vue'
import { MARK_TONES } from './FileMarkTone'

const spoken = computed(() => Object.entries(MARK_TONES).filter(([, tone]) => tone.label !== ''))
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Ce que veulent dire les couleurs">
    <li v-for="[mark, tone] in spoken" :key="mark" class="flex items-center gap-1.5">
      <span class="h-2 w-2 flex-none rounded-full" :class="tone.dot" aria-hidden="true" />
      <span class="text-[11px] whitespace-nowrap" :class="tone.text">{{ tone.label }}</span>
    </li>
  </ul>
</template>
