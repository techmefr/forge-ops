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
    class="flex flex-none flex-wrap items-baseline gap-x-8 gap-y-1 border-b border-hair bg-panel px-4 py-2.5 sm:px-8"
    :aria-label="t('personal.aria')"
  >
    <p v-for="figure in figures" :key="figure.key" class="flex min-w-0 items-baseline gap-2">
      <span class="font-mono text-base tabular-nums" :class="figure.warn ? 'text-orange' : 'text-txt-hi'">{{
        figure.value
      }}</span>
      <span class="text-sm text-txt-low">{{ t(`personal.${figure.key}`) }}</span>
      <span v-if="figure.key === 'soon'" class="text-xs text-txt-low">{{
        t('personal.soonHint', { count: SOON_IN_DAYS }, SOON_IN_DAYS)
      }}</span>
    </p>
  </section>
</template>
