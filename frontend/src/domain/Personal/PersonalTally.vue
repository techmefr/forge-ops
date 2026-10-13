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
    class="grid flex-none grid-cols-2 gap-3 bg-panel px-4 py-3 sm:px-8 min-[900px]:grid-cols-4"
    :aria-label="t('personal.aria')"
  >
    <p
      v-for="figure in figures"
      :key="figure.key"
      class="m-0 flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-2.5"
      :class="figure.warn ? 'border-orange/60' : ''"
    >
      <span
        class="title-face min-w-8 text-2xl tabular-nums"
        :class="figure.warn ? 'text-orange' : 'text-txt-hi'"
        >{{ figure.value }}</span
      >
      <span class="flex flex-col leading-tight">
        <span class="text-sm font-medium text-txt-hi">{{ t(`personal.${figure.key}`) }}</span>
        <span v-if="figure.key === 'soon'" class="text-xs text-txt-low">{{
          t('personal.soonHint', { count: SOON_IN_DAYS }, SOON_IN_DAYS)
        }}</span>
      </span>
    </p>
  </section>
</template>
