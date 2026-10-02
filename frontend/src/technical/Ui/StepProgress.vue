<script setup lang="ts">
import Glyph from './Glyph.vue'

const { steps, current, label } = defineProps<{
  steps: readonly string[]
  current: number
  label: string
}>()
</script>

<template>
  <ol class="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-2 p-0" :aria-label="label" data-test-id="step-progress">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="flex items-center gap-2 text-sm"
      :class="index === current ? 'font-medium text-txt-hi' : index < current ? 'text-txt-mid' : 'text-txt-low'"
      :aria-current="index === current ? 'step' : undefined"
    >
      <span
        class="flex size-6 flex-none items-center justify-center rounded-full border text-xs font-semibold"
        :class="
          index < current
            ? 'border-info bg-info/15 text-info'
            : index === current
              ? 'border-acc bg-acc text-ink'
              : 'border-line text-txt-mid'
        "
        aria-hidden="true"
      >
        <Glyph v-if="index < current" name="check" :size="14" />
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span>{{ step }}</span>
      <span v-if="index < steps.length - 1" class="h-px w-6 bg-line max-sm:hidden" aria-hidden="true" />
    </li>
  </ol>
</template>
