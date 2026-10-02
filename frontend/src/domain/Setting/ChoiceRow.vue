<script setup lang="ts" generic="T extends string">
defineProps<{
  label: string
  hint?: string
  options: readonly { key: T; label: string }[]
  current: T
}>()

const emit = defineEmits<{ select: [T] }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-xs text-txt-low">{{ label }}</span>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        :aria-pressed="option.key === current"
        class="rounded-md px-3 py-2 text-xs font-semibold"
        :class="option.key === current ? 'bg-acc text-ink' : 'bg-card text-txt-mid hover:bg-elev'"
        @click="emit('select', option.key)"
      >
        {{ option.label }}
      </button>
    </div>
    <span v-if="hint !== undefined" class="text-sm text-txt-low">{{ hint }}</span>
  </div>
</template>
