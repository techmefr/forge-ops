<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { PromptTemplateKey, WorkflowColumnDraft } from '@contract/WorkflowColumnContract'
import { usePhrase } from '@/technical/Language/UsePhrase'
import RequiredStar from '@/technical/Ui/RequiredStar.vue'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useAlertFocus } from '@/technical/Ui/FieldState'
import { useProjectWorkflow } from './UseProjectWorkflow'
import { useProjectWorkflows } from './UseProjectWorkflows'
import { keysAfterMove, newStep, starterSteps, templateLabelKey } from './WorkflowRule'
import WorkflowEmptyState from './WorkflowEmptyState.vue'
import WorkflowStepCard from './WorkflowStepCard.vue'
import AutopilotSection from './AutopilotSection.vue'

const props = defineProps<{ projectId: number; projectName: string }>()

const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useI18n()
const say = usePhrase()

const library = useProjectWorkflows(() => props.projectId)
const selectedId = ref<number | undefined>(undefined)
const state = useProjectWorkflow(
  () => props.projectId,
  () => selectedId.value,
)
const newName = ref('')
const newWorkflowName = ref('')
const renamed = ref('')
const drawerEl = ref<HTMLElement | null>(null)
useAlertFocus(state.failure, drawerEl)

const selected = computed(() => library.workflows.value.find((workflow) => workflow.id === selectedId.value) ?? null)
const failure = computed(() => library.failure.value ?? state.failure.value)

const columns = computed(() => state.workflow.value?.columns ?? [])
const maySettle = computed(() => state.workflow.value?.maySettle ?? false)
const admin = computed(() => state.workflow.value?.admin ?? null)

function announce(succeeded: boolean): void {
  if (succeeded) {
    emit('changed')
  }
}

async function createStarter(): Promise<void> {
  announce(
    await state.createMany(
      starterSteps((template: PromptTemplateKey) => t(templateLabelKey(template))),
    ),
  )
}

async function addStep(): Promise<void> {
  const label = newName.value.trim()
  if (label === '') {
    return
  }
  const created = await state.create(newStep(label))
  if (created) {
    newName.value = ''
  }
  announce(created)
}

async function save(columnId: number, draft: WorkflowColumnDraft): Promise<void> {
  announce(await state.update(columnId, draft))
}

async function remove(columnId: number): Promise<void> {
  announce(await state.remove(columnId))
}

async function move(key: string, direction: -1 | 1): Promise<void> {
  const keys = keysAfterMove(
    columns.value.map((column) => column.key),
    key,
    direction,
  )
  if (keys !== null) {
    announce(await state.reorder(keys))
  }
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    emit('close')
  }
}

async function pick(workflowId: number): Promise<void> {
  selectedId.value = workflowId
}

async function addWorkflow(): Promise<void> {
  const name = newWorkflowName.value.trim()
  if (name === '') {
    return
  }
  const created = await library.create(name)
  if (created !== null) {
    newWorkflowName.value = ''
    selectedId.value = created.id
    emit('changed')
  }
}

async function renameWorkflow(): Promise<void> {
  const name = renamed.value.trim()
  if (selected.value === null || name === '' || name === selected.value.name) {
    return
  }
  announce(await library.rename(selected.value.id, name))
}

async function duplicateWorkflow(): Promise<void> {
  if (selected.value === null) {
    return
  }
  const created = await library.duplicate(selected.value.id, t('workflowSettings.copyName', { name: selected.value.name }))
  if (created !== null) {
    selectedId.value = created.id
    emit('changed')
  }
}

async function removeWorkflow(): Promise<void> {
  if (selected.value === null) {
    return
  }
  const removed = await library.remove(selected.value.id)
  if (removed) {
    selectedId.value = library.workflows.value[0]?.id
    emit('changed')
  }
}

watch(selected, (workflow) => {
  renamed.value = workflow?.name ?? ''
})

watch(selectedId, () => void state.load())

onMounted(async () => {
  await library.load()
  selectedId.value ??= library.workflows.value[0]?.id
  if (selectedId.value === undefined) {
    await state.load()
  }
})
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col gap-3 overflow-y-auto border-l border-hair bg-panel px-6 py-4 min-[760px]:w-[min(560px,100vw)]"
        ref="drawerEl"
        data-test="workflow-drawer"
      >
        <div class="flex items-start gap-3">
          <DialogTitle class="title-face m-0 flex-1 text-lg text-txt-hi">
            {{ t('workflowSettings.title', { name: projectName }) }}
          </DialogTitle>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="emit('close')"
          >
            {{ t('workflowSettings.close') }}
          </button>
        </div>
        <DialogDescription class="m-0 text-sm text-txt-mid">
          {{ t('workflowSettings.intro', { name: projectName }) }}
        </DialogDescription>

        <p v-if="state.pending.value" class="m-0 text-xs text-txt-low">
          {{ t('common.loading') }}
        </p>
        <p v-if="failure !== null" id="workflow-failure" class="m-0 text-sm text-red" role="alert" tabindex="-1">
          {{ say(failure) }}
        </p>

        <div v-if="library.workflows.value.length > 0" class="flex flex-col gap-2" data-test="workflow-switcher">
          <ul class="m-0 flex list-none flex-wrap gap-2 p-0" :aria-label="t('workflowSettings.switcherAria')">
            <li v-for="workflow in library.workflows.value" :key="workflow.id">
              <button
                type="button"
                class="btn btn-sm"
                :class="workflow.id === selectedId ? 'btn-primary' : 'btn-ghost'"
                :aria-pressed="workflow.id === selectedId"
                data-test="workflow-pill"
                @click="pick(workflow.id)"
              >
                {{ workflow.name }}
              </button>
            </li>
          </ul>
          <form v-if="maySettle && selected !== null" class="flex flex-wrap items-end gap-2" @submit.prevent="renameWorkflow">
            <label class="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-txt-low">
              <span>{{ t('workflowSettings.renameWorkflow') }}</span>
              <input v-model="renamed" type="text" maxlength="60" class="field" data-test="workflow-rename" />
            </label>
            <button type="submit" class="btn btn-ghost btn-sm" :disabled="library.busy.value || renamed.trim() === ''">
              {{ t('workflowSettings.renameWorkflow') }}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" :disabled="library.busy.value" data-test="workflow-duplicate" @click="duplicateWorkflow">
              {{ t('workflowSettings.duplicateWorkflow') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="library.busy.value || library.workflows.value.length < 2"
              data-test="workflow-delete"
              @click="removeWorkflow"
            >
              {{ t('workflowSettings.deleteWorkflow') }}
            </button>
          </form>
          <form v-if="maySettle" class="flex flex-wrap items-end gap-2" @submit.prevent="addWorkflow">
            <label class="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-txt-low">
              <span>{{ t('workflowSettings.newWorkflowName') }}</span>
              <input v-model="newWorkflowName" type="text" maxlength="60" class="field" data-test="workflow-new" />
            </label>
            <button type="submit" class="btn btn-ghost btn-sm" :disabled="library.busy.value || newWorkflowName.trim() === ''" data-test="workflow-add">
              {{ t('workflowSettings.addWorkflow') }}
            </button>
          </form>
        </div>

        <template v-if="state.workflow.value !== null">
          <p class="m-0 border-b border-hair pb-2 tabular-nums text-xs text-txt-low">
            {{ t('workflowSettings.backlogFixed') }}
          </p>

          <AutopilotSection :project-id="projectId" />

          <WorkflowEmptyState
            v-if="columns.length === 0"
            :project-name="projectName"
            :admin="admin"
            :may-settle="maySettle"
            :busy="state.busy.value"
            @create="createStarter"
          />

          <ol
            v-else
            class="m-0 flex list-none flex-col divide-y divide-line p-0"
            :aria-label="t('workflowSettings.stepsOf', { name: projectName })"
          >
            <WorkflowStepCard
              v-for="(column, index) in columns"
              :key="column.id"
              :column="column"
              :index="index"
              :total="columns.length"
              :busy="state.busy.value"
              @save="(draft) => save(column.id, draft)"
              @remove="remove(column.id)"
              @move="(direction) => move(column.key, direction)"
            />
          </ol>

          <form
            v-if="maySettle"
            class="flex flex-wrap items-end gap-2"
            @submit.prevent="addStep"
          >
            <label class="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-txt-low">
              <span>{{ t('workflowSettings.newStepName') }} <RequiredStar /></span>
              <input
                v-model="newName"
                v-bind="requiredField(failure, 'workflow-failure')"
                type="text"
                maxlength="60"
                class="field"
              />
            </label>
            <button
              type="submit"
              :disabled="state.busy.value || newName.trim() === ''"
              class="btn btn-ghost btn-sm"
            >
              {{ t('workflowSettings.addStep') }}
            </button>
            <RequiredNote class="basis-full" />
          </form>

          <p class="m-0 border-t border-hair pt-2 tabular-nums text-xs text-txt-low">
            {{ t('workflowSettings.doneFixed') }}
          </p>
          <p class="m-0 text-xs text-txt-low">{{ t('workflowSettings.footnote') }}</p>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
