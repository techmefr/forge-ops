<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StepProgress from '@/technical/Ui/StepProgress.vue'
import ProjectCreateForm from './ProjectCreateForm.vue'

const emit = defineEmits<{ created: [] }>()

const { t } = useI18n()
const creating = ref(false)

function onCreated(): void {
  creating.value = false
  emit('created')
}
</script>

<template>
  <section
    class="card flex flex-col gap-4 p-6"
    :aria-label="t('emptyState.title')"
  >
    <StepProgress
      :steps="[t('getStarted.project'), t('getStarted.workflow'), t('getStarted.story')]"
      :current="0"
      :label="t('getStarted.label')"
    />
    <div>
      <p class="title-face text-lg">{{ t('emptyState.title') }}</p>
      <p class="mt-1 text-sm text-txt-mid">{{ t('emptyState.body') }}</p>
    </div>

    <ProjectCreateForm v-if="creating" @created="onCreated" @cancel="creating = false" />

    <div v-else class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="btn btn-primary btn-sm"
        @click="creating = true"
      >
        {{ t('emptyState.createProject') }}
      </button>
      <RouterLink to="/settings" class="text-sm text-acc underline">
        {{ t('emptyState.reviewWorkflow') }}
      </RouterLink>
    </div>
  </section>
</template>
