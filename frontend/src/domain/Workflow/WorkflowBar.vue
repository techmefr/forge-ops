<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectWorkflow } from './UseProjectWorkflow'
import WorkflowDrawer from './WorkflowDrawer.vue'

const props = defineProps<{ projectId: number; projectName: string }>()

const { t } = useI18n()

const state = useProjectWorkflow(() => props.projectId)
const opened = ref(false)

const maySettle = computed(() => state.workflow.value?.maySettle ?? false)
const admin = computed(() => state.workflow.value?.admin ?? null)
const count = computed(() => state.workflow.value?.columns.length ?? 0)

async function closed(): Promise<void> {
  opened.value = false
  await state.load()
}

watch(
  () => props.projectId,
  () => void state.load(),
)

onMounted(() => void state.load())
</script>

<template>
  <div v-if="state.workflow.value !== null" class="flex items-center gap-2">
    <button
      v-if="maySettle"
      type="button"
      :aria-label="t('workflowSettings.openFor', { name: projectName })"
      class="rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-txt-mid uppercase hover:border-acc"
      @click="opened = true"
    >
      <span aria-hidden="true">⚙ </span>{{ t('workflowSettings.openWithCount', { count }, count) }}
    </button>
    <small v-else-if="admin !== null" class="text-[11px] text-txt-low">
      {{ t('workflowSettings.setBy', { name: admin.name }) }}
    </small>
    <small v-else class="text-[11px] text-txt-low">{{ t('workflowSettings.noAdmin') }}</small>
    <WorkflowDrawer
      v-if="opened"
      :project-id="projectId"
      :project-name="projectName"
      @close="closed"
      @changed="state.load()"
    />
  </div>
</template>
