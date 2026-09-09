<script setup lang="ts">
const { pending, failure, empty, emptyLabel } = defineProps<{
  pending: boolean
  failure: string | null
  empty: boolean
  emptyLabel: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <p v-if="pending" class="font-mono text-xs tracking-[0.2em] text-txt-low uppercase">Chargement</p>
  <div
    v-else-if="failure !== null"
    class="rounded-2xl border border-red bg-red-soft/10 p-5"
    role="alert"
  >
    <p class="font-mono text-[11px] tracking-[0.18em] text-red uppercase">Le board a refuse</p>
    <p class="mt-2 text-sm text-txt-hi">{{ failure }}</p>
    <button
      type="button"
      class="mt-4 rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold text-txt-mid uppercase hover:border-acc"
      @click="emit('retry')"
    >
      Reessayer
    </button>
  </div>
  <p v-else-if="empty" class="text-sm text-txt-low">{{ emptyLabel }}</p>
  <slot v-else />
</template>
