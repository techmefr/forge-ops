<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AutopilotSettings } from '@contract/AutopilotContract'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { useAutopilot, settingsOf } from './UseAutopilot'

const props = defineProps<{ projectId: number }>()

const { t } = useI18n()
const say = usePhrase()
const state = useAutopilot(() => props.projectId)

const OPTIONS = ['enabled', 'autoLaunch', 'autoPublish', 'autoMerge'] as const

const labels = {
  enabled: t('autopilot.enabled'),
  autoLaunch: t('autopilot.autoLaunch'),
  autoPublish: t('autopilot.autoPublish'),
  autoMerge: t('autopilot.autoMerge'),
}

async function flip(key: keyof AutopilotSettings): Promise<void> {
  const current = state.autopilot.value
  if (current !== null) {
    await state.settle({ ...settingsOf(current), [key]: !current[key] })
  }
}

onMounted(() => void state.load())
</script>

<template>
  <section
    v-if="state.autopilot.value !== null"
    class="flex flex-col gap-2 border-b border-line pb-3"
    data-test="autopilot-section"
  >
    <h3 class="m-0 text-xs text-txt-hi">{{ t('autopilot.title') }}</h3>
    <p class="m-0 text-xs text-txt-low">{{ t('autopilot.intro') }}</p>
    <label
      v-for="key in OPTIONS"
      :key="key"
      class="flex items-center gap-2 text-sm"
      :class="key === 'autoMerge' ? 'text-orange' : 'text-txt-mid'"
    >
      <input
        type="checkbox"
        class="h-4 w-4 accent-[var(--forge-acc)]"
        :checked="state.autopilot.value[key]"
        :disabled="!state.autopilot.value.maySettle || state.busy.value"
        :data-test="`autopilot-${key}`"
        @change="flip(key)"
      />
      {{ labels[key] }}
    </label>
    <p v-if="state.failure.value !== null" class="m-0 text-sm text-red" role="alert">
      {{ say(state.failure.value) }}
    </p>
  </section>
</template>
