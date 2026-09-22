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
    <span class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">{{ label }}</span>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        :aria-pressed="option.key === current"
        class="rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase"
        :class="
          option.key === current
            ? 'border-acc bg-acc text-ink'
            : 'border-line bg-card text-txt-mid hover:border-acc'
        "
        @click="emit('select', option.key)"
      >
        {{ option.label }}
      </button>
    </div>
    <span v-if="hint !== undefined" class="text-[13px] text-txt-low">{{ hint }}</span>
  </div>
</template>
