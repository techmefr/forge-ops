<script setup lang="ts">
import { computed } from 'vue'
import { glyphOf } from './Glyph'

const { name, size = 16 } = defineProps<{ name: string; size?: number }>()

const paths = computed(() => glyphOf(name))
</script>

<template>
  <svg
    v-if="paths !== null"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="flex-none"
  >
    <path v-for="(trace, index) in paths" :key="index" :d="trace" />
  </svg>
</template>
