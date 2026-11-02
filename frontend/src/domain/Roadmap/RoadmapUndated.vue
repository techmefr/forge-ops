<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ProjectBlock } from './RoadmapBlock'

defineProps<{ block: ProjectBlock }>()

const emit = defineEmits<{ add: [projectId: number, epicId: number] }>()

const { t } = useI18n()
</script>

<template>
  <section
    class="flex-none card p-4"
    :data-test-id="`roadmap-undated-${block.entry.project.id}`"
  >
    <h3 class="title-face m-0 text-base font-bold text-txt-hi">
      {{ block.entry.project.name }} · {{ t('roadmap.undated') }}
    </h3>
    <ul class="mt-2 flex flex-wrap gap-2">
      <li
        v-for="subject in block.undated"
        :key="subject.id"
        class="flex items-center gap-2 rounded-lg bg-elev px-3 py-1.5 text-sm text-txt-hi"
      >
        {{ subject.title }}
        <button
          type="button"
          class="text-xs font-bold text-acc"
          :aria-label="`${t('roadmap.addEvent')}, ${subject.title}`"
          @click="emit('add', block.entry.project.id, subject.id)"
        >
          {{ t('roadmap.addEvent') }}
        </button>
      </li>
    </ul>
  </section>
</template>
