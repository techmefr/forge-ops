<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutopilot, settingsOf } from './UseAutopilot'

const props = defineProps<{ projectId: number }>()

const { t } = useI18n()
const state = useAutopilot(() => props.projectId)

const enabled = computed(() => state.autopilot.value?.enabled ?? false)
const maySettle = computed(() => state.autopilot.value?.maySettle ?? false)
const label = computed(() => {
  if (!maySettle.value) {
    return t('autopilot.badgeLocked')
  }
  return enabled.value ? t('autopilot.badgeOn') : t('autopilot.badgeOff')
})

async function toggle(): Promise<void> {
  const current = state.autopilot.value
  if (current !== null && maySettle.value) {
    await state.settle({ ...settingsOf(current), enabled: !current.enabled })
  }
}

watch(
  () => props.projectId,
  () => void state.load(),
)

onMounted(() => void state.load())
</script>

<template>
  <button
    v-if="state.autopilot.value !== null"
    type="button"
    role="switch"
    :aria-checked="enabled"
    :aria-label="label"
    :title="label"
    :disabled="!maySettle || state.busy.value"
    class="rounded-md border px-2.5 py-1 text-xs disabled:opacity-60"
    :class="enabled ? 'border-acc text-acc' : 'border-line text-txt-low hover:bg-elev'"
    data-test="autopilot-badge"
    @click="toggle"
  >
    <span aria-hidden="true">{{ enabled ? '●' : '○' }} </span>{{ t('autopilot.badge') }}
  </button>
</template>
