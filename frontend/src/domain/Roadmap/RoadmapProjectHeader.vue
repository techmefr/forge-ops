<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { safeHref } from '@/technical/Ui/SafeHref'
import { tintOf } from '@/technical/Ui/Tint'
import type { ProjectBlock } from './RoadmapBlock'

defineProps<{ block: ProjectBlock }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-1 px-3 py-2">
    <span class="flex items-center gap-2">
      <span
        class="size-2.5 flex-none rounded-full"
        :style="{ background: tintOf(block.entry.project.colour) }"
        aria-hidden="true"
      />
      <strong class="title-face text-sm text-txt-hi">
        {{ block.entry.project.name }}
      </strong>
    </span>
    <span class="text-xs text-txt-mid">
      {{
        t(
          'roadmap.subjectCount',
          { count: block.entry.subjects.length },
          block.entry.subjects.length,
        )
      }}
      <template v-if="block.lateCount > 0">
        · {{ t('roadmap.lateCount', { count: block.lateCount }) }}
      </template>
    </span>
    <span
      v-if="block.toWriteCount > 0"
      class="w-fit text-xs font-bold text-orange"
    >
      {{ t('roadmap.minutesCount', { count: block.toWriteCount }, block.toWriteCount) }}
    </span>
    <ul
      v-if="block.entry.links.length > 0"
      class="flex flex-wrap gap-1"
      :aria-label="t('roadmap.linksAria', { project: block.entry.project.name })"
    >
      <li v-for="link in block.entry.links" :key="`${link.kind}-${link.url}`">
        <a
          :href="safeHref(link.url)"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded px-1.5 py-0.5 text-xs text-info hover:bg-elev max-sm:inline-flex max-sm:min-h-10 max-sm:min-w-10 max-sm:items-center max-sm:justify-center"
        >
          {{ t(`linkKind.${link.kind}`) }}
        </a>
      </li>
    </ul>
  </div>
</template>
