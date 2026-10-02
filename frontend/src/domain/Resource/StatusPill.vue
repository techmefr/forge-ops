<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFleet } from '@/domain/Shell/UseFleet'
import ResourceDrawer from './ResourceDrawer.vue'
import { useResourceStatus } from './UseResourceStatus'

const { t } = useI18n()
const { live } = useFleet()
const status = useResourceStatus()
const opened = ref(false)

const DOT = {
  unknown: 'bg-line',
  ok: 'bg-green',
  busy: 'bg-orange',
  full: 'bg-red',
} as const
</script>

<template>
  <button
    type="button"
    class="flex min-h-10 items-center gap-2 rounded-full border-0 bg-elev px-2.5 py-1.5 text-xs text-txt-mid hover:text-txt-hi sm:min-h-9"
    :title="t('forge.resource.details')"
    aria-haspopup="dialog"
    data-test="resource-status"
    @click="opened = true"
  >
    <span class="h-1.5 w-1.5 flex-none rounded-full" :class="DOT[status.level.value]" aria-hidden="true" />
    <span>{{ t('shell.agentCount', { count: live }, live) }}</span>
    <span class="hidden tabular-nums sm:inline">{{
      t('forge.resource.budgetValue', { spent: status.spent.value.toFixed(2), cap: status.cap.value.toFixed(2) })
    }}</span>
    <span v-if="status.room.value <= 0" class="text-red">{{ t('forge.resource.fullShort') }}</span>
    <span class="sr-only" data-test="status-room">{{
      status.room.value > 0
        ? t('forge.resource.room', { count: status.room.value }, status.room.value)
        : t('forge.resource.full')
    }}</span>
    <span class="sr-only">{{ t('forge.resource.details') }}</span>
  </button>
  <ResourceDrawer v-if="opened" @close="opened = false" />
</template>
