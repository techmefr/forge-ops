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
    class="flex flex-none flex-wrap gap-3 border-b border-line bg-panel px-6 py-4"
    :aria-label="t('personal.aria')"
  >
    <article
      v-for="figure in figures"
      :key="figure.key"
      class="min-w-[150px] flex-1 rounded-lg border bg-card px-4 py-3"
      :class="figure.warn ? 'border-orange' : 'border-line'"
    >
      <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
        {{ t(`personal.${figure.key}`) }}
      </p>
      <p
        class="display-italic mt-1 text-[28px] leading-none"
        :class="figure.warn ? 'text-orange' : 'text-txt-hi'"
      >
        {{ figure.value }}
      </p>
      <p v-if="figure.key === 'soon'" class="mt-1 text-[11px] text-txt-low">
        {{ t('personal.soonHint', { count: SOON_IN_DAYS }, SOON_IN_DAYS) }}
      </p>
    </article>
  </section>
</template>
