<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubjectRow } from './RoadmapBlock'
import type { LabelPlacement, RoadmapSubject } from './Timeline'
import { useRoadmapLabels } from './UseRoadmapLabels'

const props = defineProps<{ row: SubjectRow; todayLeft: number; today: string }>()

const { t } = useI18n()
const { ownerOf, barText, barAria } = useRoadmapLabels(toRef(props, 'today'))

function barTone(subject: RoadmapSubject): string {
  if (subject.state === 'done') {
    return 'bg-green'
  }
  return subject.state === 'blocked' ? 'bg-red' : 'bg-acc'
}

function outsideStyle(placement: Extract<LabelPlacement, { inside: false }>): Record<string, string> {
  return placement.flip ? { right: `${placement.at}%` } : { left: `${placement.at}%` }
}
</script>

<template>
  <li class="grid grid-cols-[minmax(170px,240px)_1fr] border-b border-hair/60">
    <div class="flex flex-col px-3 py-1.5 pl-6">
      <strong class="text-sm text-txt-hi">
        {{ row.subject.title }}
        <span
          v-if="row.bar.lateDays > 0"
          class="ml-1 text-xs font-bold text-red"
        >
          {{ t('roadmap.late') }}
        </span>
        <span
          v-if="row.toWrite"
          class="ml-1 rounded px-1 text-xs font-bold text-orange"
        >
          {{ t('roadmap.minutesToWrite') }}
        </span>
      </strong>
      <small class="text-xs text-txt-mid">
        {{ ownerOf(row.subject) }} · {{ t(`epicState.${row.subject.state}`) }}
      </small>
    </div>
    <div class="relative h-9">
      <span
        class="absolute top-0 bottom-0 w-0.5 bg-txt-hi/60"
        :style="{ left: `${todayLeft}%` }"
        aria-hidden="true"
      />
      <span
        role="img"
        tabindex="0"
        class="absolute top-2 flex h-5 items-center overflow-hidden rounded px-2 text-xs font-semibold whitespace-nowrap text-ink"
        :class="barTone(row.subject)"
        :style="{ left: `${row.extent.left}%`, width: `${row.extent.width}%` }"
        :aria-label="barAria(row)"
        :title="barAria(row)"
        data-test-id="roadmap-bar"
      >
        <template v-if="row.placement.inside">{{ barText(row) }}</template>
      </span>
      <span
        v-if="row.extent.lateWidth > 0"
        class="roadmap-late absolute top-2 h-5 rounded-r"
        :style="{
          left: `${row.extent.left + row.extent.width}%`,
          width: `${row.extent.lateWidth}%`,
        }"
        aria-hidden="true"
      />
      <span
        v-if="!row.placement.inside"
        class="pointer-events-none absolute top-2.5 text-xs font-semibold whitespace-nowrap text-txt-hi"
        :style="outsideStyle(row.placement)"
        aria-hidden="true"
      >
        {{ barText(row) }}
      </span>
    </div>
  </li>
</template>
