<script setup lang="ts">
import { computed } from 'vue'
import { initialsOf, toneOf } from './Initials'

const { name, size = 28 } = defineProps<{ name: string; size?: number }>()

const initials = computed(() => initialsOf(name))
const tone = computed(() => toneOf(name))
</script>

<template>
  <span
    class="inline-flex flex-none items-center justify-center rounded-full text-xs font-semibold"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      color: `var(--forge-${tone})`,
      background: `color-mix(in srgb, var(--forge-${tone}) 18%, transparent)`,
    }"
    aria-hidden="true"
  >
    {{ initials }}
  </span>
</template>
