<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import { tallyOf, SOON_IN_DAYS } from './Tally'
import type { ProjectCard } from '@/domain/Board/BoardModel'

const { t } = useI18n()

const cards = useResource<readonly ProjectCard[]>(() => board.read('/api/board/projects'))
const self = useResource<{ login: string }>(() => board.read('/api/board/self'))

const tally = computed(() => tallyOf(cards.data.value ?? [], self.data.value?.login ?? null))

const figures = computed(() => [
  { key: 'mine', value: tally.value.mine, warn: false },
  { key: 'late', value: tally.value.late, warn: tally.value.late > 0 },
  { key: 'soon', value: tally.value.soon, warn: false },
  { key: 'attention', value: tally.value.attention, warn: tally.value.attention > 0 },
])

onMounted(() => Promise.all([self.reload(), cards.reload()]))
</script>

<template>
  <section
    class="scrollbar-none flex flex-none items-baseline gap-x-5 gap-y-1 overflow-x-auto bg-panel px-4 py-1.5 sm:flex-wrap sm:gap-x-8 sm:overflow-x-visible sm:px-8 sm:py-2.5"
    :aria-label="t('personal.aria')"
  >
    <p v-for="figure in figures" :key="figure.key" class="flex flex-none items-baseline gap-1.5 sm:gap-2">
      <span class="font-mono text-base tabular-nums" :class="figure.warn ? 'text-orange' : 'text-txt-hi'">{{
        figure.value
      }}</span>
      <span class="text-xs whitespace-nowrap text-txt-low sm:text-sm">{{ t(`personal.${figure.key}`) }}</span>
      <span v-if="figure.key === 'soon'" class="text-xs text-txt-low max-sm:hidden">{{
        t('personal.soonHint', { count: SOON_IN_DAYS }, SOON_IN_DAYS)
      }}</span>
    </p>
  </section>
</template>
