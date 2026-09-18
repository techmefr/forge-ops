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
    class="flex flex-none items-stretch gap-0.5 border-b border-line bg-panel px-6"
    :aria-label="t(`${group}.aria`)"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab"
      :to="`${base}/${tab}`"
      class="flex items-center gap-1.5 border-b-[3px] px-4 py-2.5 transition-colors"
      :class="
        current === tab
          ? `border-acc text-txt-hi`
          : `border-transparent text-txt-mid hover:text-txt-hi`
      "
    >
      <span class="display-italic text-[13px] uppercase">{{
        t(`${group}.${tab}`)
      }}</span>
    </RouterLink>
  </nav>
</template>
