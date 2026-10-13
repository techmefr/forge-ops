<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectWorkflow } from './UseProjectWorkflow'
import { useProjectWorkflows } from './UseProjectWorkflows'
import WorkflowDrawer from './WorkflowDrawer.vue'

const props = defineProps<{ projectId: number; projectName: string }>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()

const state = useProjectWorkflow(() => props.projectId)
const all = useProjectWorkflows(() => props.projectId)
const opened = ref(false)

const maySettle = computed(() => state.workflow.value?.maySettle ?? false)
const admin = computed(() => state.workflow.value?.admin ?? null)
const count = computed(() => all.workflows.value.length)

async function closed(): Promise<void> {
  opened.value = false
  await Promise.all([state.load(), all.load()])
  emit('changed')
}

watch(
  () => props.projectId,
  () => void Promise.all([state.load(), all.load()]),
)

onMounted(() => void Promise.all([state.load(), all.load()]))
</script>

<template>
  <div v-if="state.workflow.value !== null" class="flex items-center gap-2">
    <button
      v-if="maySettle"
      type="button"
      :aria-label="`${t('workflowSettings.openWithCount', { count }, count)}, ${projectName}`"
      class="btn btn-ghost btn-sm"
      @click="opened = true"
    >
      <span aria-hidden="true">⚙ </span>{{ t('workflowSettings.openWithCount', { count }, count) }}
    </button>
    <small v-else-if="admin !== null" class="text-xs text-txt-low">
      {{ t('workflowSettings.setBy', { name: admin.name }) }}
    </small>
    <small v-else class="text-xs text-txt-low">{{ t('workflowSettings.noAdmin') }}</small>
    <WorkflowDrawer
      v-if="opened"
      :project-id="projectId"
      :project-name="projectName"
      @close="closed"
      @changed="state.load()"
    />
  </div>
</template>
