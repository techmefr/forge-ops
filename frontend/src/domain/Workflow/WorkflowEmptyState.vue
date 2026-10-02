<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StepProgress from '@/technical/Ui/StepProgress.vue'
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
  <section class="card flex flex-col gap-3 p-6" :aria-label="t('workflowSettings.emptyTitle', { name: projectName })">
    <StepProgress
      :steps="[t('getStarted.project'), t('getStarted.workflow'), t('getStarted.story')]"
      :current="1"
      :label="t('getStarted.label')"
    />
    <p class="title-face m-0 text-lg text-txt-hi">
      {{ t('workflowSettings.emptyTitle', { name: projectName }) }}
    </p>
    <p class="m-0 text-sm text-txt-mid">{{ body }}</p>
    <div v-if="maySettle" class="flex flex-col items-start gap-1.5 pt-1">
      <button
        type="button"
        :disabled="busy === true"
        class="btn btn-primary btn-sm"
        @click="emit('create')"
      >
        {{ t('workflowSettings.createStarter') }}
      </button>
      <small class="text-xs text-txt-low">{{ t('workflowSettings.starterHint') }}</small>
    </div>
  </section>
</template>
