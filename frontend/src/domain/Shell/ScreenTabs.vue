<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  base: string
  tabs: readonly string[]
  current: string
  group: string
}>()

const { t } = useI18n()
</script>

<template>
  <nav
    class="scrollbar-none flex flex-none items-stretch gap-0.5 overflow-x-auto border-b border-hair bg-panel px-4 sm:px-6"
    :aria-label="t(`${group}.aria`)"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab"
      :to="`${base}/${tab}`"
      class="flex min-h-10 flex-none items-center gap-1.5 border-b-2 px-3 py-2.5 whitespace-nowrap transition-colors"
      :class="current === tab ? `border-acc text-txt-hi` : `border-transparent text-txt-mid hover:text-txt-hi`"
    >
      <span class="text-sm font-medium">{{
        t(`${group}.${tab}`)
      }}</span>
    </RouterLink>
  </nav>
</template>
