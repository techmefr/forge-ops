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
    class="flex flex-none flex-wrap items-stretch gap-0.5 border-b border-line bg-panel px-4 sm:px-6"
    :aria-label="t(`${group}.aria`)"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab"
      :to="`${base}/${tab}`"
      class="flex items-center gap-1.5 min-h-10 flex-none border-b-2 px-3 py-2.5 transition-colors"
      :class="current === tab ? `border-acc text-txt-hi` : `border-transparent text-txt-mid hover:text-txt-hi`"
    >
      <span class="text-sm font-medium">{{
        t(`${group}.${tab}`)
      }}</span>
    </RouterLink>
  </nav>
</template>
