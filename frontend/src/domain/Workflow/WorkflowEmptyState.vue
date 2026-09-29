<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WorkflowAdmin } from '@contract/WorkflowColumnContract'

const props = defineProps<{
  projectName: string
  admin: WorkflowAdmin | null
  maySettle: boolean
  busy?: boolean
}>()

const emit = defineEmits<{ create: [] }>()

const { t } = useI18n()

const body = computed(() => {
  if (props.maySettle) {
    return t('workflowSettings.emptyAdmin')
  }
  return props.admin === null
    ? t('workflowSettings.emptyNoAdmin')
    : t('workflowSettings.emptyMember', { admin: props.admin.name })
})
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-lg border border-dashed border-acc bg-acc-soft/20 p-4"
    :aria-label="t('workflowSettings.emptyTitle', { name: projectName })"
  >
    <p class="m-0 text-[14px] font-semibold text-txt-hi">
      {{ t('workflowSettings.emptyTitle', { name: projectName }) }}
    </p>
    <p class="m-0 text-[13px] text-txt-mid">{{ body }}</p>
    <div v-if="maySettle" class="flex flex-col items-start gap-2">
      <button
        type="button"
        :disabled="busy === true"
        class="rounded-lg border border-acc bg-acc px-4 py-2 font-mono text-[11px] font-bold text-ink uppercase disabled:opacity-40"
        @click="emit('create')"
      >
        {{ t('workflowSettings.createStarter') }}
      </button>
      <small class="text-[11px] text-txt-low">{{ t('workflowSettings.starterHint') }}</small>
    </div>
  </section>
</template>
