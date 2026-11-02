<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectEvent } from '@contract/EventContract'
import { EVENT_TONES } from './EventTone'
import { type upcomingOf } from './Timeline'
import type { RoadmapProject } from './UseRoadmap'
import { useRoadmapLabels } from './UseRoadmapLabels'

const props = defineProps<{
  items: ReturnType<typeof upcomingOf>
  projects: readonly RoadmapProject[]
  today: string
}>()

const emit = defineEmits<{ open: [event: ProjectEvent]; create: [] }>()

const { t } = useI18n()
const { dayLabel, typeLabel, eventName, daysLeftLabel } = useRoadmapLabels(toRef(props, 'today'))

function projectNameOf(event: ProjectEvent): string {
  return props.projects.find((entry) => entry.project.id === event.projectId)?.project.name ?? ''
}
</script>

<template>
  <section
    class="flex-none"
    :aria-label="t('roadmap.upcoming')"
    data-test-id="roadmap-upcoming"
  >
    <div class="flex items-center gap-3">
      <h3 class="section-title">
        {{ t('roadmap.upcoming') }}
      </h3>
      <button
        type="button"
        class="btn btn-primary btn-sm ml-auto"
        @click="emit('create')"
      >
        {{ t('roadmap.newEvent') }}
      </button>
    </div>
    <p v-if="items.length === 0" class="mt-2 text-sm text-txt-low">
      {{ t('roadmap.upcomingEmpty') }}
    </p>
    <ul v-else class="mt-2 flex gap-2 overflow-x-auto pb-1">
      <li v-for="item in items" :key="item.event.id" class="flex-none">
        <button
          type="button"
          class="flex min-w-40 flex-col items-start gap-0.5 rounded-lg bg-card px-3 py-2 text-left hover:bg-elev"
          @click="emit('open', item.event)"
        >
          <span class="tabular-nums text-xs font-bold" :class="EVENT_TONES[item.event.type].text">
            {{ daysLeftLabel(item.daysLeft) }} · {{ dayLabel(item.event.date) }}
          </span>
          <span class="text-sm font-semibold text-txt-hi">{{ eventName(item.event) }}</span>
          <span class="text-xs text-txt-mid">
            {{ typeLabel(item.event) }} · {{ projectNameOf(item.event) }}
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
